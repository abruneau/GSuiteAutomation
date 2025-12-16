# GSuiteAutomation

GSuiteAutomation is a collection of scripts and utilities designed to automate various tasks within the Google Workspace (formerly G Suite) environment. The project is written in TypeScript and is intended to be deployed as Google Apps Script projects or used as standalone automation tools.

## Features

- **Calendar Automation**: Manage meetings, convert meetings to notes, and interact with Google Calendar.
- **Mail Automation**: Parsing, and domain management.
- **Database Utilities**: Handle domain and TLD databases for email and calendar operations.
- **Helpers & Logging**: Utility functions and a logger for easier debugging and script management.

## Project Structure

```
GSuiteAutomation/
├── src/
│   ├── Calendar/
│   ├── Mail/
│   ├── database/
│   ├── context.ts
│   ├── helpers.ts
│   ├── index.ts
│   ├── logger.ts
│   └── settings.ts
├── test/
│   ├── email/
│   └── url-fetch/
├── appsscript.json
├── package.json
├── tsconfig.json
├── rollup.config.mjs
└── ...
```

## Setup

### Prerequisites

- Node.js (v16 or later recommended)
- npm or yarn
- Google Apps Script CLI (`clasp`) if deploying to Google Apps Script

### Installation

1. **Clone the repository:**

   ```sh
   git clone <repo-url>
   cd GSuiteAutomation
   ```

2. **Install dependencies:**

   ```sh
   npm install
   # or
   yarn install
   ```

3. **Build the project:**

   ```sh
   npm run build
   ```

4. **(Optional) Test the project:**

   ```sh
   npm test
   ```

5. **Deploy to Google Apps Script:**
   - Install [clasp](https://github.com/google/clasp):
     ```sh
     npm install -g @google/clasp
     ```
   - Authenticate clasp:
     ```sh
     clasp login
     clasp create --type sheets --rootDir dist
     ```
   - Push code to Apps Script:
     ```sh
     npm run deploy
     ```

## Configuration Options

- **`src/settings.ts`**: Configure script-wide settings such as API keys, default calendar IDs, etc.
- **`appsscript.json`**: Google Apps Script project manifest. Adjust scopes and settings as needed.
- **Environment Variables**: If using locally, you may use `.env` files or set environment variables for sensitive data.

## Scripts

- `npm run build` — Compile TypeScript to JavaScript.
- `npm test` — Run tests using Jest.
- `npm run lint` — Lint the codebase (if configured).
- `npm run deploy` — Deploy to Google Apps Script (if configured).

## Testing

Tests are located in the `test/` directory and use Jest. To run tests:

```sh
npm test
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements or bug fixes.

## License

See [LICENSE](LICENSE) for details.
