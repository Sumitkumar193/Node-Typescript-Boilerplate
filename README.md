# Node TypeScript Boilerplate

This is a boilerplate for building a Node.js application with TypeScript. It includes a set of scripts and dependencies to help you get started quickly with development, building, and linting.

## Features

- TypeScript for type-safe JavaScript development
- Nodemon for automatic server restarts during development
- ESLint and Prettier for code quality and formatting
- Environment variable management with `dotenv`
- Basic security setup with `helmet`
- Input validation with `joi`
- JSON Web Token (JWT) authentication

## Getting Started

### Prerequisites

- Node.js (version 14 or later)
- npm (version 6 or later) or Yarn

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/sumitkumar193/node-typescript-boilerplate.git
   cd node-typescript-boilerplate
   ```

2. Install the dependencies:

   ```sh
   npm install
   # or
   yarn install
   ```

3. Set up the environment variables:
   ```sh
   cp .env.example .env
   ```

   Update the `.env` file with your environment variables.

4. Set up the database and generate the Prisma client:
    ```sh
    npx prisma migrate dev # For development
    npx prisma migrate deploy # For production 
    npx prisma db push
    ```

### Running the Project

- Start the development server:

  ```sh
  npm run dev
  # or
  yarn dev
  ```

- Build the project:

  ```sh
  npm run build
  # or
  yarn build
  ```

- Start the built project:

  ```sh
  npm start
  # or
  yarn start
  ```

### Linting

- Lint and format the code:

  ```sh
  npm run lint
  # or
  yarn lint
  ```

### Socket.io Server Implementation
- Socket.io server is implemented in the project. You can use it by importing Socket from `src/socket/Socket.ts` file.
- You can also use the socket instance to broadcast events to all connected clients.
- If user is identified, you can use the socket instance to emit events to specific user.
  #### Example of Broadcasting event to all connected clients
  ```typescript
  import Socket from '/src/socket/Socket';

  Socket.emit('event-name', { data: 'data' });
  ```

  #### Example of Emitting event to specific user
  ```typescript
  import { Socket } from '/src/socket/Socket';

  const { user } = req.body;
  Socket.emitToUser(user.id, 'event-name', { data: 'data' });
  ```

## Project Structure

```
├── src
│   ├── index.ts         # Entry point of the application
│   ├── routes           # Application routes
│   ├── controllers      # Route controllers
│   ├── middlewares      # Custom middlewares
│   ├── models           # Data models
│   ├── services         # Business logic
│   ├── interfaces       # Interfaces of various types
│   ├── validations      # Input validations for request body types
├── dist                 # Compiled output
├── prisma               # Prisma configuration and Schema
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # NPM configuration
└── README.md            # Project documentation
```

## Scripts

- `dev`: Start the development server with Nodemon
- `build`: Clean the `dist` folder and compile TypeScript
- `start`: Start the compiled project with Nodemon
- `lint`: Lint and format the source files

## Dependencies

### Dev Dependencies

- `@types/express`
- `@types/jsonwebtoken`
- `@types/morgan`
- `@types/node`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint`
- `eslint-config-airbnb-base`
- `eslint-config-prettier`
- `eslint-plugin-import`
- `nodemon`
- `prettier`
- `ts-node`
- `typescript`

### Dependencies

- `dotenv`
- `express`
- `helmet`
- `joi`
- `jsonwebtoken`
- `morgan`
- `p-limit`

## License

This project is licensed under the ISC License.

## Author

Sumit Kumar

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Contact

For questions or feedback, please reach out to [itsme.sumit96@gmail.com]
