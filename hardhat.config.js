require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";

// RPC URLs
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-mainnet.alchemyapi.io/v2/your-api-key";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

// Testnet RPC URLs
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://eth-goerli.alchemyapi.io/v2/your-api-key";
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL || "https://polygon-mumbai.alchemyapi.io/v2/your-api-key";
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/";
const ARBITRUM_GOERLI_RPC_URL = process.env.ARBITRUM_GOERLI_RPC_URL || "https://goerli-rollup.arbitrum.io/rpc";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      metadata: {
        bytecodeHash: "none"
      }
    }
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20,
        accountsBalance: "10000000000000000000000"
      },
      forking: {
        url: ETHEREUM_RPC_URL,
        blockNumber: 18500000,
        enabled: false
      }
    },

    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: [PRIVATE_KEY]
    },

    // Ethereum Mainnet
    ethereum: {
      url: ETHEREUM_RPC_URL,
      chainId: 1,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2,
      timeout: 300000
    },

    // Ethereum Goerli Testnet
    goerli: {
      url: GOERLI_RPC_URL,
      chainId: 5,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    // Polygon Mainnet
    polygon: {
      url: POLYGON_RPC_URL,
      chainId: 137,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2
    },

    // Polygon Mumbai Testnet
    mumbai: {
      url: MUMBAI_RPC_URL,
      chainId: 80001,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    // BSC Mainnet
    bsc: {
      url: BSC_RPC_URL,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    // BSC Testnet
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    // Arbitrum Mainnet
    arbitrum: {
      url: ARBITRUM_RPC_URL,
      chainId: 42161,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    // Arbitrum Goerli Testnet
    arbitrumGoerli: {
      url: ARBITRUM_GOERLI_RPC_URL,
      chainId: 421613,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    }
  },

  // Contract verification
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      arbitrumGoerli: ARBISCAN_API_KEY
    },
    customChains: [
      {
        network: "arbitrumGoerli",
        chainId: 421613,
        urls: {
          apiURL: "https://api-goerli.arbiscan.io/api",
          browserURL: "https://goerli.arbiscan.io"
        }
      }
    ]
  },

  // Gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 30,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
    reportFormat: "markdown",
    includeIntrinsicGas: true,
    excludeContracts: ["mocks/", "test/"]
  },

  // Contract size reporting
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: ["Cataklism"]
  },

  // Test configuration
  mocha: {
    timeout: 300000,
    retries: 0,
    bail: true
  },

  // Deployment configuration
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0, // Ethereum mainnet
      5: 0, // Goerli
      137: 0, // Polygon
      80001: 0, // Mumbai
      56: 0, // BSC
      97: 0, // BSC testnet
      42161: 0, // Arbitrum
      421613: 0 // Arbitrum Goerli
    },
    treasury: {
      default: 1,
      1: "0x1234567890123456789012345678901234567890", // Replace with actual treasury
      5: 1,
      137: "0x1234567890123456789012345678901234567890",
      80001: 1,
      56: "0x1234567890123456789012345678901234567890",
      97: 1,
      42161: "0x1234567890123456789012345678901234567890",
      421613: 1
    },
    emergencyDAO: {
      default: 2,
      1: "0x0987654321098765432109876543210987654321", // Replace with actual DAO
      5: 2,
      137: "0x0987654321098765432109876543210987654321",
      80001: 2,
      56: "0x0987654321098765432109876543210987654321",
      97: 2,
      42161: "0x0987654321098765432109876543210987654321",
      421613: 2
    }
  },

  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments"
  },

  // External contracts
  external: {
    contracts: [
      {
        artifacts: "node_modules/@openzeppelin/contracts/build/contracts",
        deploy: "node_modules/@openzeppelin/contracts/scripts"
      }
    ]
  },

  // Compiler settings for different Solidity versions
  compilers: [
    {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    {
      version: "0.8.18",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  ],

  // Plugin configurations
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  },

  // Coverage configuration
  coverage: {
    exclude: ["contracts/mocks/", "contracts/test/"],
    skipFiles: ["mocks/", "test/"]
  },

  // Deployment verification
  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API_KEY
    }
  },

  // Tenderly configuration
  tenderly: {
    project: process.env.TENDERLY_PROJECT || "cataklism-protocol",
    username: process.env.TENDERLY_USERNAME || "cataklism",
    privateVerification: false
  },

  // Dodoc documentation
  dodoc: {
    runOnCompile: false,
    debugMode: false,
    outputDir: "./docs/contracts",
    include: ["contracts/"]
  }
};
