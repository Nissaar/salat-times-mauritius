# Salat Times Mauritius

A comprehensive web application for Islamic prayer times in Mauritius with support for all villages and cities across the island, including Rodrigues.

## Features

- 🕌 **Complete Prayer Times**: Sehri, Fajr, Sunrise, Istiwa, Zohr, Asr, Sunset, Maghrib, Esha
- 📍 **200+ Locations**: All villages and cities in Mauritius pre-loaded with coordinates
- ⛰️ **Altitude Adjustments**: Automatic sunrise/sunset adjustments based on location altitude
- 🏫 **Madhab Support**: Hanafi (default) and Shafi'i calculation methods
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- 🌍 **GPS Support**: Auto-detect nearest location using device GPS
- 🔍 **Location Search**: Autocomplete search for quick location selection
- 👤 **Admin Panel**: Secure authentication with approval workflow
- 📅 **Bulk Data Entry**: Enter prayer times for entire months at once
- 🔄 **Yearly Repeat**: Times are stored by day-of-year and repeat annually

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MariaDB
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (reverse proxy)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git (for cloning)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd salat-times-mauritius2
```

2. Configure environment variables:
```bash
# Edit .env file if needed
nano .env
```

3. Start the application:
```bash
docker-compose up -d
```

4. Access the application:
- **Main Site**: http://localhost
- **Admin Panel**: http://localhost/admin
- **phpMyAdmin**: http://localhost:8080

### Default Admin Credentials

- **Email**: admin@salattimes.mu
- **Password**: admin123456

⚠️ **Important**: Change the default password after first login!

## Project Structure

```
salat-times-mauritius2/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js      # Database connection
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT authentication
│   │   ├── routes/
│   │   │   ├── admin.js         # Admin endpoints
│   │   │   ├── adjustments.js   # Altitude adjustments
│   │   │   ├── auth.js          # Authentication
│   │   │   ├── locations.js     # Location search
│   │   │   └── prayerTimes.js   # Prayer times API
│   │   ├── utils/
│   │   │   └── logger.js        # Winston logger
│   │   └── server.js            # Express app
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── admin/
│   │   ├── css/admin.css
│   │   ├── js/admin.js
│   │   └── index.html
│   ├── css/style.css
│   ├── js/app.js
│   ├── images/favicon.svg
│   ├── Dockerfile
│   └── index.html
├── database/
│   └── init/
│       ├── 01-schema.sql        # Database schema
│       └── 02-locations.sql     # Location data
├── nginx/
│   └── nginx.conf               # Nginx configuration
├── docker-compose.yml
├── .env
├── .gitignore
└── README.md
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/locations` | List all locations |
| GET | `/api/locations/search?q=` | Search locations |
| GET | `/api/locations/districts` | List all districts |
| GET | `/api/locations/nearest/coords?lat=&lng=` | Find nearest location |
| GET | `/api/prayer-times?date=&locationId=&madhab=` | Get prayer times |
| GET | `/api/adjustments` | Get altitude adjustments |

### Protected Endpoints (Require Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Request registration |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/prayer-times/bulk` | Bulk update prayer times |
| GET | `/api/admin/users` | List users |
| GET | `/api/admin/registration-requests` | List pending registrations |
| POST | `/api/admin/registration-requests/:id/approve` | Approve registration |
| POST | `/api/admin/registration-requests/:id/reject` | Reject registration |

## Prayer Time Entry

Prayer times are entered once and repeat yearly based on the day of the year (1-366). This means:

1. Enter times for January 1st (day 1) - they will apply to every January 1st
2. Leap year day (Feb 29, day 60) is included
3. Times can be bulk-entered month by month via the admin panel

### Required Times Per Day

For each day, the following times are required:
- **Sehri** (Imsak - stop eating for fasting)
- **Fajr** (Dawn prayer)
- **Sunrise** (Prayer forbidden)
- **Istiwa/Zawaal** (Solar noon - prayer forbidden)
- **Zohr/Dhuhr** (Noon prayer)
- **Asr Hanafi** (Afternoon - Hanafi calculation)
- **Asr Shafi'i** (Afternoon - Shafi'i calculation)
- **Sunset** (Prayer forbidden)
- **Maghrib Hanafi** (Evening - Hanafi)
- **Maghrib Shafi'i** (Evening - Shafi'i)
- **Esha Hanafi** (Night - Hanafi)
- **Esha Shafi'i** (Night - Shafi'i)

## Altitude Adjustments

Mauritius has varying altitudes from sea level to ~828m. The application automatically adjusts sunrise/sunset times based on location altitude:

| Altitude Range | Sunrise Adj. | Sunset Adj. |
|---------------|--------------|-------------|
| 0-50m | 0 min | 0 min |
| 51-150m | -1 min | +1 min |
| 151-300m | -2 min | +2 min |
| 301-500m | -3 min | +3 min |
| 501-828m | -4 min | +4 min |

## Development

### Running Locally Without Docker

1. Start MariaDB locally
2. Import database schemas
3. Start backend:
```bash
cd backend
npm install
npm run dev
```
4. Serve frontend with any static server

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | db |
| `DB_PORT` | Database port | 3306 |
| `DB_USER` | Database user | salat_user |
| `DB_PASSWORD` | Database password | salat_password |
| `DB_NAME` | Database name | salat_times |
| `JWT_SECRET` | JWT signing secret | change-this-secret |
| `JWT_EXPIRES_IN` | Token expiry | 24h |
| `ADMIN_EMAIL` | Default admin email | admin@salattimes.mu |
| `ADMIN_PASSWORD` | Default admin password | admin123456 |

## Security Notes

1. **Change default credentials** immediately after deployment
2. **Update JWT_SECRET** in production
3. **Enable HTTPS** when deploying publicly
4. **Review CORS settings** for production

## License

MIT License - Feel free to use for any purpose.

## Acknowledgments

- Prayer time calculations should be verified with local Islamic authorities
- Location data sourced from geographic databases
- Built with ❤️ for the Muslim community of Mauritius
