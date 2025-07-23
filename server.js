const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple in-memory storage
let links = [];
let clicks = [];

// Initialize with sample data
console.log('Starting Link Tracker...');
links.push({
  id: uuidv4(),
  original_url: 'https://wa.me/1234567890',
  short_code: 'join-autonomous-car-masterclass',
  title: 'Autonomous Car Masterclass WhatsApp Group',
  source: 'src=dm',
  created_at: new Date().toISOString(),
  total_clicks: 0
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

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Link Tracker API is running',
    links_count: links.length,
    clicks_count: clicks.length
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    data: {
      links: links.length,
      clicks: clicks.length
    }
  });
});

// Create a new trackable link
app.post('/api/links', (req, res) => {
  try {
    const { original_url, title, custom_code, source } = req.body;
    
    if (!original_url) {
      return res.status(400).json({ error: 'Original URL is required' });
    }

    // Check if custom code is provided, otherwise generate one
    let shortCode = custom_code;
    if (!shortCode) {
      shortCode = generateShortCode();
    } else {
      // Check if custom code already exists
      const existingLink = links.find(l => l.short_code === shortCode);
      if (existingLink) {
        return res.status(400).json({ error: 'Custom code already exists. Please choose a different one.' });
      }
    }

    const newLink = {
      id: uuidv4(),
      original_url,
      short_code: shortCode,
      title: title || 'Untitled Link',
      source: source || null,
      created_at: new Date().toISOString(),
      total_clicks: 0
    };

    links.push(newLink);

    res.json({
      id: newLink.id,
      short_code: newLink.short_code,
      trackable_url: `${req.protocol}://${req.get('host')}/r/${newLink.short_code}`,
      original_url: newLink.original_url,
      title: newLink.title,
      source: newLink.source
    });
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Redirect endpoint
app.get('/r/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  
  const link = links.find(l => l.short_code === shortCode);
  if (!link) {
    return res.status(404).send('Link not found');
  }

  // Track the click with better IP detection
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress || 
             req.ip || 
             'unknown';
  
  const referrer = req.headers.referer || req.headers.referrer || '';
  const userAgent = req.headers['user-agent'] || '';
  
  const newClick = {
    id: uuidv4(),
    link_id: link.id,
    ip_address: ip.split(',')[0].trim(), // Take first IP if multiple
    user_agent: userAgent,
    referrer: referrer,
    clicked_at: new Date().toISOString()
  };

  // Debug logging for IP detection
  console.log(`Click tracked for link ${link.short_code}:`, {
    ip: ip.split(',')[0].trim(),
    userAgent: userAgent.substring(0, 50) + '...',
    referrer: referrer.substring(0, 50) + '...',
    totalClicks: link.total_clicks + 1
  });

  clicks.push(newClick);
  link.total_clicks = (link.total_clicks || 0) + 1;

  // Redirect to original URL
  res.redirect(link.original_url);
});

// Get all links
app.get('/api/links', (req, res) => {
  try {
    res.json(links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Get analytics for a specific link
app.get('/api/links/:id/analytics', (req, res) => {
  const { id } = req.params;
  
  const link = links.find(l => l.id === id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const linkClicks = clicks.filter(c => c.link_id === id);
  
  // Calculate analytics with better unique visitor detection
  const totalClicks = linkClicks.length;
  
  // Get unique IPs, filtering out 'unknown' and empty values
  const uniqueIPs = new Set(
    linkClicks
      .map(click => click.ip_address)
      .filter(ip => ip && ip !== 'unknown' && ip !== '')
  ).size;
  
  // Top referrers
  const referrers = linkClicks
    .filter(click => click.referrer && click.referrer !== '')
    .reduce((acc, click) => {
      try {
        const domain = new URL(click.referrer).hostname;
        acc[domain] = (acc[domain] || 0) + 1;
      } catch (e) {
        // Invalid URL, skip
      }
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
      recentClicks: linkClicks.slice(0, 20)
    }
  });
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  
  links = links.filter(link => link.id !== id);
  clicks = clicks.filter(click => click.link_id !== id);
  
  res.json({ message: 'Link deleted successfully' });
});

app.listen(PORT, () => {
  console.log(`Link Tracker running on http://localhost:${PORT}`);
}); 