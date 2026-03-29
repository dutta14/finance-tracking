# Finance Tracking App

A modern, responsive web application for financial planning and tracking built with React and Vite.

## Features

- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modular Architecture**: Clean separation of components and pages with their own CSS files
- **Modern UI**: Gradient design with smooth animations and hover effects
- **Accessibility**: Focus-friendly navigation and semantic HTML
- **Public Domain CSS**: Uses normalize.css for CSS reset

## Project Structure

```
finance-tracking/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable React components
│   │   ├── Navigation.jsx
│   │   └── Navigation.css
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   ├── Home.css
│   │   ├── Plan.jsx
│   │   └── Plan.css
│   ├── App.jsx          # Main App component with routing
│   └── main.jsx         # React entry point
├── styles/              # Global styles
│   ├── normalize.css    # CSS normalization (public domain)
│   └── app.css          # Global app styles
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
└── package.json         # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:

```bash
cd finance-tracking
```

2. Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### Build for Production

Create an optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Technologies Used

- **React 18** - UI library
- **Vite** - Lightning-fast build tool and dev server
- **CSS3** - Responsive styling with Flexbox and CSS Grid
- **Normalize.css** - Public domain CSS reset

## Responsive Design

The app is fully responsive with media queries optimized for:

- Desktop (1200px and above)
- Tablet (769px - 1199px)
- Mobile (768px and below)

## Styling Architecture

All styles are kept modular and separate:

- **Global Styles**: `styles/normalize.css` and `styles/app.css`
- **Component Styles**: Each component has its own CSS file (e.g., `Navigation.css`)
- **Page Styles**: Each page has its own CSS file (e.g., `Home.css`, `Plan.css`)

This keeps the codebase maintainable and easy to extend.

## Color Scheme

- **Primary Gradient**: `#667eea` to `#764ba2` (vibrant purple/blue)
- **Light Background**: `#f8f9fa`
- **Text (Primary)**: `#333`
- **Text (Secondary)**: `#666`
- **Accent**: White with transparency on hover

## Pages

### Home Page

- Hero section with welcome message
- Feature cards highlighting app capabilities
- Call-to-action section

### Plan Page

- Placeholder for financial planning features
- Ready for detailed implementation

## Navigation

Simple client-side routing using React state to switch between pages without page reloads.

## Next Steps for Development

Once basic setup is complete, you can expand the Plan page with:

1. Financial plan creation and management forms
2. Scenario modeling tools
3. Data visualization with charts
4. Local storage or backend API integration
5. Additional pages for tracking and analysis

## License

See the LICENSE file for details.
