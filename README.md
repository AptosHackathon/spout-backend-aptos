# Spout Backend Aptos

A NestJS-based backend service for interacting with the Aptos blockchain network. This application provides real-time event polling and monitoring capabilities for Aptos accounts and transactions.

## 🌐 Live Deployment

**TEE Deployed Application**: [https://92a7be451ddb4f83627f81b188f8137bba80a65d-8090.dstack-prod5.phala.network/](https://92a7be451ddb4f83627f81b188f8137bba80a65d-8090.dstack-prod5.phala.network/)

The application is deployed on Phala's Trusted Execution Environment (TEE) infrastructure for enhanced security and privacy.

## 🚀 Features

- **Aptos Blockchain Integration**: Built-in connection to Aptos Devnet using the official Aptos TypeScript SDK
- **Real-time Event Polling**: Automated polling service that monitors Aptos account events every 30 seconds
- **KYC Management System**: Complete KYC verification and status checking functionality
- **Token Operations**: Mint and burn operations for multiple token types (LQD_NEW, USDT_NEW, USDC_NEW)
- **Order Book Integration**: Real-time monitoring and processing of buy/sell order events
- **Supabase Integration**: Database operations for persistent storage of order records
- **Health Check Endpoint**: Monitor application and blockchain connection status
- **Docker Support**: Ready-to-deploy Docker configuration with multi-stage builds
- **TypeScript**: Full TypeScript support with proper type definitions
- **Structured Logging**: Comprehensive logging with NestJS Logger
- **TEE Deployment**: Secure deployment on Phala's Trusted Execution Environment

## 🏗️ Architecture

The application follows a modular NestJS architecture with the following core modules:

### Core Modules

- **AppModule**: Main application module that orchestrates all other modules
- **Web3Module**: Handles Aptos blockchain interactions and client management
- **PollingModule**: Manages automated event polling and monitoring
- **SupabaseModule**: Database integration module for persistent data storage

### Services

- **Web3Service**: Core service for Aptos blockchain operations
  - Account information retrieval
  - Event fetching from transactions
  - Network connectivity monitoring
  - Order event processing and formatting
  
- **PollingService**: Scheduled service for continuous event monitoring
  - Runs every 10 seconds using cron jobs
  - Monitors specified Aptos accounts for new events
  - Processes buy/sell order events
  - Handles automated token operations based on order events
  - Extensible for custom event processing logic

## 📡 API Endpoints

### Health Check
- **GET** `/health`
  - Returns application status and Aptos network connectivity
  - Response includes network configuration and connection status
  - Example response:
    ```json
    {
      "status": "ok",
      "aptos_connected": true,
      "network": "devnet"
    }
    ```

### KYC Management
- **GET** `/kyc/status/:userAddress`
  - Check KYC verification status for a specific user address
  - Returns verification status and user information
  - Example response:
    ```json
    {
      "success": true,
      "userAddress": "0x123...",
      "isVerified": true
    }
    ```

- **POST** `/kyc/verify`
  - Verify a user's KYC status
  - Body: `{ "userAddress": "0x123..." }`
  - Returns transaction details and verification result
  - Example response:
    ```json
    {
      "success": true,
      "transactionHash": "0xabc...",
      "gasUsed": "1234",
      "userAddress": "0x123..."
    }
    ```

### Default
- **GET** `/`
  - Returns basic "Hello World" message
  - Useful for testing application availability

## 📋 Prerequisites

- Node.js 22.15.0 or higher
- npm or yarn package manager
- Docker (optional, for containerized deployment)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spout-backend-aptos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   The application uses Aptos Devnet by default. No additional environment configuration is required for basic usage.

## 🚀 Running the Application

### Development Mode
```bash
# Start in development mode with hot reload
npm run start:dev

# Start in debug mode
npm run start:debug
```

### Production Mode
```bash
# Build the application
npm run build

# Start in production mode
npm start:prod
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d
```

## 🧪 Testing

```bash
# Generate cryptographic keys for testing
npm run generate:keys

# Format code
npm run format

# Lint code
npm run lint
```

**Note**: Test scripts are configured but not yet implemented. The application includes key generation utilities for development purposes.

## 📦 Dependencies

### Core Dependencies
- **@nestjs/core**: NestJS framework core
- **@nestjs/schedule**: Cron job and task scheduling
- **@aptos-labs/ts-sdk**: Official Aptos TypeScript SDK
- **reflect-metadata**: Metadata reflection API
- **rxjs**: Reactive extensions for JavaScript

### Development Dependencies
- **TypeScript**: Type-safe JavaScript development
- **Jest**: Testing framework
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting

## 🔧 Configuration

### Aptos Network
The application is currently configured for Aptos Devnet. To change the network:

1. Modify the `Web3Service` constructor in `src/web3/web3.service.ts`
2. Update the `AptosConfig` network parameter:
   ```typescript
   const config = new AptosConfig({ network: Network.MAINNET }); // or Network.TESTNET
   ```

### Polling Configuration
The polling service runs every 10 seconds by default. To modify:

1. Edit the `@Cron` decorator in `src/polling/polling.service.ts`
2. Use different `CronExpression` values or custom cron patterns

**Note**: This application is configured for Aptos Devnet. Ensure you have proper configuration and security measures in place before deploying to production networks.
