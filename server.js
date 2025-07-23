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

// Simple in-memory database for Vercel compatibility
class InMemoryDB {
  constructor() {
    this.links = [];
    this.clicks = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    console.log('Initializing in-memory database...');
    
    // Add some sample data for testing
    if (this.links.length === 0) {
      console.log('Adding sample data...');
      this.links.push({
        id: uuidv4(),
        original_url: 'https://wa.me/1234567890',
        short_code: 'sample1',
        title: 'Sample WhatsApp Link',
        created_at: new Date().toISOString(),
        total_clicks: 0
      });
    }
    
    this.initialized = true;
    console.log('Database initialized successfully');
  }

  async getLinks() {
    await this.init();
    return this.links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async createLink(linkData) {
    await this.init();
    const newLink = {
      id: uuidv4(),
      short_code: generateShortCode(),
      ...linkData,
      created_at: new Date().toISOString(),
      total_clicks: 0
    };
    this.links.push(newLink);
    return newLink;
  }

  async getLinkByShortCode(shortCode) {
    await this.init();
    return this.links.find(link => link.short_code === shortCode);
  }

  async getLinkById(id) {
    await this.init();
    return this.links.find(link => link.id === id);
  }

  async addClick(clickData) {
    await this.init();
    const newClick = {
      id: uuidv4(),
      ...clickData,
      clicked_at: new Date().toISOString()
    };
    this.clicks.push(newClick);
    
    // Update link click count
    const link = this.links.find(l => l.id === clickData.link_id);
    if (link) {
      link.total_clicks = (link.total_clicks || 0) + 1;
    }
    
    return newClick;
  }

  async getClicksByLinkId(linkId) {
    await this.init();
    return this.clicks.filter(click => click.link_id === linkId);
  }

  async deleteLink(id) {
    await this.init();
    this.links = this.links.filter(link => link.id !== id);
    this.clicks = this.clicks.filter(click => click.link_id !== id);
  }

  async getStats() {
    await this.init();
    return {
      links_count: this.links.length,
      clicks_count: this.clicks.length
    };
  }
}

// Initialize database
const db = new InMemoryDB();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const stats = await db.getStats();
  res.json({ 
    status: 'ok', 
    message: 'Link Tracker API is running',
    environment: process.env.NODE_ENV || 'development',
    ...stats
  });
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  const stats = await db.getStats();
  res.json({ 
    message: 'API is working! (Updated for deployment)',
    timestamp: new Date().toISOString(),
    data: {
      ...stats
    }
  });
});

// Create a new trackable link
app.post('/api/links', async (req, res) => {
  try {
    const { original_url, title } = req.body;
    
    console.log('Creating new link:', { original_url, title });
    
    if (!original_url) {
      return res.status(400).json({ error: 'Original URL is required' });
    }

  const newLink = await db.createLink({ original_url, title });

  res.json({
    id: newLink.id,
    short_code: newLink.short_code,
    trackable_url: `${req.protocol}://${req.get('host')}/r/${newLink.short_code}`,
    original_url: newLink.original_url,
    title: newLink.title
  });
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create link', details: error.message });
  }
});

// Redirect endpoint
app.get('/r/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  
  const link = await db.getLinkByShortCode(shortCode);
  if (!link) {
    return res.status(404).send('Link not found');
  }

  // Track the click
  const userAgent = new UserAgent(req.headers['user-agent']);
  const ip = req.ip || req.connection.remoteAddress;
  const referrer = req.headers.referer || req.headers.referrer || '';
  const geo = geoip.lookup(ip);
  
  await db.addClick({
    link_id: link.id,
    ip_address: ip,
    user_agent: req.headers['user-agent'],
    referrer: referrer,
    country: geo ? geo.country : null,
    city: geo ? geo.city : null
  });
  
  // Redirect to original URL
  res.redirect(link.original_url);
});

// Get all links
app.get('/api/links', async (req, res) => {
  try {
    console.log('Fetching links from storage...');
    const links = await db.getLinks();
    console.log(`Found ${links.length} links`);
    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links', details: error.message });
  }
});

// Get analytics for a specific link
app.get('/api/links/:id/analytics', async (req, res) => {
  const { id } = req.params;
  
  const link = await db.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const clicks = await db.getClicksByLinkId(id);
  
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
app.delete('/api/links/:id', async (req, res) => {
  const { id } = req.params;
  
  await db.deleteLink(id);
  
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