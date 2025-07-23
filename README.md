# Link Tracker

A powerful link tracking service that helps you monitor clicks, analyze traffic sources, and track user engagement for your links (WhatsApp, social media, etc.).

## Features

- **Link Creation**: Convert any URL into a trackable link
- **Click Tracking**: Monitor total clicks and unique visitors
- **Referrer Analysis**: See where your traffic is coming from
- **Geographic Data**: Track visitor locations by country and city
- **Real-time Analytics**: View detailed analytics for each link
- **Modern UI**: Beautiful, responsive interface
- **Easy Management**: Create, view, and delete links with ease

## How It Works

1. **Create a Trackable Link**: Enter your original URL (like a WhatsApp link) and get a short, trackable URL
2. **Share Your Link**: Use the generated trackable URL in your marketing campaigns
3. **Track Performance**: Monitor clicks, referrers, and geographic data in real-time
4. **Analyze Results**: Get detailed insights about your link performance

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Setup

1. **Clone or download the project**
   ```bash
   cd tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and go to `http://localhost:3000`

## Usage

### Creating a Trackable Link

1. Open the application in your browser
2. Click on the "Create Link" tab
3. Enter your original URL (e.g., `https://wa.me/1234567890`)
4. Add an optional title for easy identification
5. Click "Create Trackable Link"
6. Copy the generated trackable URL and use it in your campaigns

### Viewing Analytics

1. Go to the "Manage Links" tab
2. Click "View Analytics" on any link
3. See detailed information including:
   - Total clicks and unique visitors
   - Top referrers (where traffic comes from)
   - Geographic distribution
   - Recent click history

### Example Use Cases

- **WhatsApp Marketing**: Track clicks on your WhatsApp business links
- **Social Media Campaigns**: Monitor performance of links shared on social platforms
- **Email Marketing**: Track click-through rates in email campaigns
- **Affiliate Marketing**: Monitor referral traffic and conversions

## API Endpoints

### Create Link
```
POST /api/links
Content-Type: application/json

{
  "original_url": "https://wa.me/1234567890",
  "title": "My WhatsApp Link"
}
```

### Get All Links
```
GET /api/links
```

### Get Analytics
```
GET /api/links/:id/analytics
```

### Delete Link
```
DELETE /api/links/:id
```

## Database

The application uses in-memory storage for data. Data is stored in memory and will be reset when the server restarts.

### Tables

- **links**: Stores link information (ID, original URL, short code, title, etc.)
- **clicks**: Stores click tracking data (IP, user agent, referrer, location, etc.)

## Security Features

- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS protection
- Helmet.js for security headers

## Customization

### Changing the Port

Edit `server.js` and modify the PORT variable:
```javascript
const PORT = process.env.PORT || 3000;
```

### Database Location

The application uses in-memory storage. No database file is created. Data is stored in memory and will be reset when the server restarts.

## Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
- `PORT`: Set the port number (default: 3000)

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT in server.js or kill the process using the port
2. **Database errors**: Delete the `tracker.db` file and restart the application
3. **CORS issues**: The application includes CORS middleware, but you may need to configure it for your specific domain

### Logs

Check the console output for error messages and debugging information.

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for your own purposes.

---

**Happy Tracking! 🎯** 