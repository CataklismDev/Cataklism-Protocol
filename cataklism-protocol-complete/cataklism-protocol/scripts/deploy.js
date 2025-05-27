const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Cataklism Protocol Deployment Script
 * Deploys all core smart contracts with proper configuration
 */

async function main() {
  console.log("🚀 Starting Cataklism Protocol deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  const deploymentData = {
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // Deployment configuration
  const config = {
    // Token configuration
    token: {
      name: "Cataklism Protocol",
      symbol: "CTKL",
      initialSupply: ethers.utils.parseEther("100000000"), // 100M tokens
      maxSupply: ethers.utils.parseEther("1000000000"), // 1B tokens
    },

    // Protocol configuration
    protocol: {
      protocolFee: 250, // 2.5%
      maxFee: 1000, // 10%
      withdrawalDelay: 7 * 24 * 60 * 60, // 7 days
      emergencyDelay: 72 * 60 * 60, // 72 hours
    },

    // Vault configuration
    vault: {
      managementFee: 200, // 2%
      performanceFee: 1000, // 10%
      withdrawalFee: 50, // 0.5%
      emergencyFee: 500, // 5%
    }
  };

  try {
    // 1. Deploy Treasury and DAO contracts first
    console.log("📦 Deploying Treasury...");
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployer.address);
    await treasury.deployed();
    console.log("✅ Treasury deployed to:", treasury.address);
    deploymentData.contracts.treasury = treasury.address;

    console.log("📦 Deploying Emergency DAO...");
    const EmergencyDAO = await ethers.getContractFactory("EmergencyDAO");
    const emergencyDAO = await EmergencyDAO.deploy([deployer.address], 1);
    await emergencyDAO.deployed();
    console.log("✅ Emergency DAO deployed to:", emergencyDAO.address);
    deploymentData.contracts.emergencyDAO = emergencyDAO.address;

    // 2. Deploy Cataklism Token
    console.log("\n📦 Deploying Cataklism Token...");
    const CataklismToken = await ethers.getContractFactory("CataklismToken");
    const cataklismToken = await CataklismToken.deploy(
      treasury.address,
      deployer.address, // Team wallet
      deployer.address  // Liquidity pool (temporary)
    );
    await cataklismToken.deployed();
    console.log("✅ Cataklism Token deployed to:", cataklismToken.address);
    deploymentData.contracts.token = cataklismToken.address;

    // Wait for confirmations
    console.log("⏳ Waiting for confirmations...");
    await cataklismToken.deployTransaction.wait(2);

    // 3. Deploy Cataklism Core
    console.log("\n📦 Deploying Cataklism Core...");
    const CataklismCore = await ethers.getContractFactory("CataklismCore");
    const cataklismCore = await CataklismCore.deploy(
      cataklismToken.address,
      treasury.address,
      emergencyDAO.address
    );
    await cataklismCore.deployed();
    console.log("✅ Cataklism Core deployed to:", cataklismCore.address);
    deploymentData.contracts.core = cataklismCore.address;

    await cataklismCore.deployTransaction.wait(2);

    // 4. Deploy Cataklism Vault
    console.log("\n📦 Deploying Cataklism Vault...");
    const CataklismVault = await ethers.getContractFactory("CataklismVault");
    const cataklismVault = await CataklismVault.deploy(
      cataklismToken.address,
      treasury.address,
      deployer.address // Keeper
    );
    await cataklismVault.deployed();
    console.log("✅ Cataklism Vault deployed to:", cataklismVault.address);
    deploymentData.contracts.vault = cataklismVault.address;

    await cataklismVault.deployTransaction.wait(2);

    // 5. Deploy additional utility contracts
    console.log("\n📦 Deploying Price Oracle...");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    console.log("✅ Price Oracle deployed to:", priceOracle.address);
    deploymentData.contracts.priceOracle = priceOracle.address;

    console.log("\n📦 Deploying Strategy Manager...");
    const StrategyManager = await ethers.getContractFactory("StrategyManager");
    const strategyManager = await StrategyManager.deploy(
      cataklismVault.address,
      priceOracle.address
    );
    await strategyManager.deployed();
    console.log("✅ Strategy Manager deployed to:", strategyManager.address);
    deploymentData.contracts.strategyManager = strategyManager.address;

    // 6. Setup initial configuration
    console.log("\n⚙️  Setting up initial configuration...");

    // Grant roles to Core contract
    console.log("🔐 Setting up token permissions...");
    const MINTER_ROLE = await cataklismToken.MINTER_ROLE();
    await cataklismToken.grantRole(MINTER_ROLE, cataklismCore.address);
    console.log("✅ Granted MINTER_ROLE to Core contract");

    // Setup vault authorization
    console.log("🔐 Setting up vault permissions...");
    await cataklismVault.setFeeCollector(treasury.address);
    await cataklismVault.setKeeper(deployer.address);
    console.log("✅ Vault permissions configured");

    // Add initial staking pool
    console.log("🏊 Adding initial staking pool...");
    const rewardRate = ethers.utils.parseEther("1000"); // 1000 tokens per second
    await cataklismCore.addPool(cataklismToken.address, rewardRate, false);
    console.log("✅ Initial CTKL staking pool added");

    // 7. Transfer some tokens for testing
    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("\n🧪 Setting up test environment...");

      // Mint some tokens to deployer for testing
      const testAmount = ethers.utils.parseEther("10000");
      await cataklismToken.mint(deployer.address, testAmount);
      console.log("✅ Minted test tokens to deployer");

      // Approve contracts
      await cataklismToken.approve(cataklismCore.address, ethers.constants.MaxUint256);
      await cataklismToken.approve(cataklismVault.address, ethers.constants.MaxUint256);
      console.log("✅ Approved contracts for testing");
    }

    // 8. Verify deployment
    console.log("\n🔍 Verifying deployment...");

    const tokenSupply = await cataklismToken.totalSupply();
    const poolCount = await cataklismCore.poolCount();
    const vaultAssets = await cataklismVault.totalAssets();

    console.log("📊 Deployment Summary:");
    console.log(`   • Token Total Supply: ${ethers.utils.formatEther(tokenSupply)} CTKL`);
    console.log(`   • Active Pools: ${poolCount}`);
    console.log(`   • Vault Total Assets: ${ethers.utils.formatEther(vaultAssets)} CTKL`);

    // 9. Save deployment data
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment data saved to: ${deploymentFile}`);

    // 10. Generate contract interaction examples
    const examplesFile = path.join(deploymentsDir, `${network.name}-examples.js`);
    const examples = generateExamples(deploymentData.contracts);
    fs.writeFileSync(examplesFile, examples);
    console.log(`📝 Interaction examples saved to: ${examplesFile}`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Contract Addresses:");
    Object.entries(deploymentData.contracts).forEach(([name, address]) => {
      console.log(`   • ${name}: ${address}`);
    });

    // Gas usage summary
    const gasUsed = await deployer.provider.getTransactionCount(deployer.address);
    console.log(`\n⛽ Total transactions: ${gasUsed}`);
    console.log(`💰 Final balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

function generateExamples(contracts) {
  return `// Cataklism Protocol Contract Interaction Examples
// Generated on ${new Date().toISOString()}

const { ethers } = require("ethers");

// Contract addresses
const CONTRACTS = ${JSON.stringify(contracts, null, 2)};

// ABIs (you'll need to import these from your artifacts)
const CATAKLISM_TOKEN_ABI = [...]; // Import from artifacts
const CATAKLISM_CORE_ABI = [...];  // Import from artifacts
const CATAKLISM_VAULT_ABI = [...]; // Import from artifacts

async function main() {
  // Setup provider and signer
  const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
  const signer = provider.getSigner();

  // Initialize contracts
  const token = new ethers.Contract(CONTRACTS.token, CATAKLISM_TOKEN_ABI, signer);
  const core = new ethers.Contract(CONTRACTS.core, CATAKLISM_CORE_ABI, signer);
  const vault = new ethers.Contract(CONTRACTS.vault, CATAKLISM_VAULT_ABI, signer);

  // Example 1: Check token balance
  const balance = await token.balanceOf(await signer.getAddress());
  console.log("Token balance:", ethers.utils.formatEther(balance));

  // Example 2: Stake tokens
  const stakeAmount = ethers.utils.parseEther("100");
  await token.approve(core.address, stakeAmount);
  await core.deposit(0, stakeAmount); // Pool ID 0
  console.log("Staked 100 CTKL tokens");

  // Example 3: Deposit to vault
  const vaultAmount = ethers.utils.parseEther("50");
  await token.approve(vault.address, vaultAmount);
  await vault.deposit(vaultAmount);
  console.log("Deposited 50 CTKL to vault");

  // Example 4: Check rewards
  const pending = await core.pendingReward(0, await signer.getAddress());
  console.log("Pending rewards:", ethers.utils.formatEther(pending));

  // Example 5: Get vault stats
  const vaultStats = await vault.getVaultStats();
  console.log("Vault TVL:", ethers.utils.formatEther(vaultStats.totalAssets));
}

// Run examples
main().catch(console.error);
`;
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };`;
