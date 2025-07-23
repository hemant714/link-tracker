const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const UserAgent = require('user-agents');
const geoip = require('geoip-lite');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database setup - use in-memory for Vercel
const db = new sqlite3.Database(process.env.NODE_ENV === 'production' ? ':memory:' : './tracker.db');

// Add error handling for database
db.on('error', (err) => {
  console.error('Database error:', err);
});

// Initialize database tables
db.serialize(() => {
  console.log('Initializing database tables...');
  
  // Links table
  db.run(`CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_clicks INTEGER DEFAULT 0
  )`, (err) => {
    if (err) {
      console.error('Error creating links table:', err);
    } else {
      console.log('Links table created/verified successfully');
    }
  });

  // Clicks table
  db.run(`CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    city TEXT,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating clicks table:', err);
    } else {
      console.log('Clicks table created/verified successfully');
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  // Test database connection
  db.get('SELECT COUNT(*) as count FROM links', (err, result) => {
    if (err) {
      console.error('Health check database error:', err);
      res.json({ 
        status: 'error', 
        message: 'Link Tracker API is running but database has issues',
        error: err.message 
      });
    } else {
      res.json({ 
        status: 'ok', 
        message: 'Link Tracker API is running',
        database: 'connected',
        links_count: result.count
      });
    }
  });
});

// Create a new trackable link
app.post('/api/links', (req, res) => {
  const { original_url, title } = req.body;
  
  console.log('Creating new link:', { original_url, title });
  
  if (!original_url) {
    return res.status(400).json({ error: 'Original URL is required' });
  }

  const linkId = uuidv4();
  const shortCode = generateShortCode();
  
  db.run(
    'INSERT INTO links (id, original_url, short_code, title) VALUES (?, ?, ?, ?)',
    [linkId, original_url, shortCode, title || 'Untitled Link'],
    function(err) {
      if (err) {
        console.error('Database error creating link:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          // Retry with a different short code
          const newShortCode = generateShortCode();
          db.run(
            'INSERT INTO links (id, original_url, short_code, title) VALUES (?, ?, ?, ?)',
            [linkId, original_url, newShortCode, title || 'Untitled Link'],
            function(err) {
              if (err) {
                console.error('Database error on retry:', err);
                return res.status(500).json({ error: 'Failed to create link', details: err.message });
              }
              console.log('Link created successfully with retry');
              res.json({
                id: linkId,
                short_code: newShortCode,
                trackable_url: `${req.protocol}://${req.get('host')}/r/${newShortCode}`,
                original_url,
                title: title || 'Untitled Link'
              });
            }
          );
        } else {
          return res.status(500).json({ error: 'Failed to create link', details: err.message });
        }
      } else {
        console.log('Link created successfully');
        res.json({
          id: linkId,
          short_code: shortCode,
          trackable_url: `${req.protocol}://${req.get('host')}/r/${shortCode}`,
          original_url,
          title: title || 'Untitled Link'
        });
      }
    }
  );
});

// Redirect endpoint
app.get('/r/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  
  db.get('SELECT * FROM links WHERE short_code = ?', [shortCode], (err, link) => {
    if (err || !link) {
      return res.status(404).send('Link not found');
    }

    // Track the click
    const userAgent = new UserAgent(req.headers['user-agent']);
    const ip = req.ip || req.connection.remoteAddress;
    const referrer = req.headers.referer || req.headers.referrer || '';
    const geo = geoip.lookup(ip);
    
    db.run(
      'INSERT INTO clicks (link_id, ip_address, user_agent, referrer, country, city) VALUES (?, ?, ?, ?, ?, ?)',
      [
        link.id,
        ip,
        req.headers['user-agent'],
        referrer,
        geo ? geo.country : null,
        geo ? geo.city : null
      ]
    );

    // Update total clicks
    db.run('UPDATE links SET total_clicks = total_clicks + 1 WHERE id = ?', [link.id]);

    // Redirect to original URL
    res.redirect(link.original_url);
  });
});

// Get all links
app.get('/api/links', (req, res) => {
  console.log('Fetching links from database...');
  db.all('SELECT * FROM links ORDER BY created_at DESC', (err, links) => {
    if (err) {
      console.error('Database error fetching links:', err);
      return res.status(500).json({ error: 'Failed to fetch links', details: err.message });
    }
    console.log(`Found ${links ? links.length : 0} links`);
    res.json(links || []);
  });
});

// Get analytics for a specific link
app.get('/api/links/:id/analytics', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM links WHERE id = ?', [id], (err, link) => {
    if (err || !link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    db.all('SELECT * FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC', [id], (err, clicks) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch analytics' });
      }

      // Calculate analytics
      const totalClicks = clicks.length;
      const uniqueIPs = new Set(clicks.map(click => click.ip_address)).size;
      
      // Top referrers
      const referrers = clicks
        .filter(click => click.referrer)
        .reduce((acc, click) => {
          const domain = new URL(click.referrer).hostname;
          acc[domain] = (acc[domain] || 0) + 1;
          return acc;
        }, {});

      // Top countries
      const countries = clicks
        .filter(click => click.country)
        .reduce((acc, click) => {
          acc[click.country] = (acc[click.country] || 0) + 1;
          return acc;
        }, {});

      res.json({
        link,
        analytics: {
          totalClicks,
          uniqueVisitors: uniqueIPs,
          referrers: Object.entries(referrers)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10),
          countries: Object.entries(countries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10),
          recentClicks: clicks.slice(0, 20)
        }
      });
    });
  });
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM clicks WHERE link_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete clicks' });
    }
    
    db.run('DELETE FROM links WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete link' });
      }
      res.json({ message: 'Link deleted successfully' });
    });
  });
});

// Helper function to generate short codes
function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

app.listen(PORT, () => {
  console.log(`Link Tracker running on http://localhost:${PORT}`);
}); 