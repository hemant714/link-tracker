const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// Removed fs import since we're using in-memory storage
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

// Simple in-memory storage for Vercel compatibility
let data = {
  links: [],
  clicks: []
};

// Initialize data storage
console.log('Initializing in-memory data storage...');

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Link Tracker API is running',
    environment: process.env.NODE_ENV || 'development',
    links_count: data.links.length,
    clicks_count: data.clicks.length
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working! (Updated for deployment)',
    timestamp: new Date().toISOString(),
    data: {
      links: data.links.length,
      clicks: data.clicks.length
    }
  });
});

// Create a new trackable link
app.post('/api/links', (req, res) => {
  try {
    const { original_url, title } = req.body;
    
    console.log('Creating new link:', { original_url, title });
    
    if (!original_url) {
      return res.status(400).json({ error: 'Original URL is required' });
    }

  const linkId = uuidv4();
  const shortCode = generateShortCode();
  
  const newLink = {
    id: linkId,
    original_url,
    short_code: shortCode,
    title: title || 'Untitled Link',
    created_at: new Date().toISOString(),
    total_clicks: 0
  };

  data.links.push(newLink);

  res.json({
    id: linkId,
    short_code: shortCode,
    trackable_url: `${req.protocol}://${req.get('host')}/r/${shortCode}`,
    original_url,
    title: title || 'Untitled Link'
  });
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create link', details: error.message });
  }
});

// Redirect endpoint
app.get('/r/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  
  const link = data.links.find(l => l.short_code === shortCode);
  if (!link) {
    return res.status(404).send('Link not found');
  }

  // Track the click
  const userAgent = new UserAgent(req.headers['user-agent']);
  const ip = req.ip || req.connection.remoteAddress;
  const referrer = req.headers.referer || req.headers.referrer || '';
  const geo = geoip.lookup(ip);
  
  const newClick = {
    id: uuidv4(),
    link_id: link.id,
    ip_address: ip,
    user_agent: req.headers['user-agent'],
    referrer: referrer,
    country: geo ? geo.country : null,
    city: geo ? geo.city : null,
    clicked_at: new Date().toISOString()
  };

  data.clicks.push(newClick);
  
  // Update total clicks
  link.total_clicks = (link.total_clicks || 0) + 1;

  // Redirect to original URL
  res.redirect(link.original_url);
});

// Get all links
app.get('/api/links', (req, res) => {
  try {
    console.log('Fetching links from storage...');
    console.log(`Found ${data.links.length} links`);
    res.json(data.links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links', details: error.message });
  }
});

// Get analytics for a specific link
app.get('/api/links/:id/analytics', (req, res) => {
  const { id } = req.params;
  
  const link = data.links.find(l => l.id === id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const clicks = data.clicks.filter(c => c.link_id === id);
  
  // Calculate analytics
  const totalClicks = clicks.length;
  const uniqueIPs = new Set(clicks.map(click => click.ip_address)).size;
  
  // Top referrers
  const referrers = clicks
    .filter(click => click.referrer)
    .reduce((acc, click) => {
      try {
        const domain = new URL(click.referrer).hostname;
        acc[domain] = (acc[domain] || 0) + 1;
      } catch (e) {
        // Invalid URL, skip
      }
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

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  
  // Remove clicks for this link
  data.clicks = data.clicks.filter(c => c.link_id !== id);
  
  // Remove the link
  data.links = data.links.filter(l => l.id !== id);
  
  res.json({ message: 'Link deleted successfully' });
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