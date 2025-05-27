import { ethers, Contract, Provider, JsonRpcProvider } from 'ethers';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { CacheService } from './cache';
import { EventEmitter } from 'events';

// Contract ABIs (simplified for demo)
const CATAKLISM_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

const CATAKLISM_CORE_ABI = [
  'function poolCount() view returns (uint256)',
  'function totalValueLocked() view returns (uint256)',
  'function pools(uint256) view returns (tuple(address token, uint256 totalLiquidity, uint256 rewardRate, uint256 lastUpdateTime, uint256 accRewardPerShare, bool isActive))',
  'function userInfo(uint256, address) view returns (tuple(uint256 amount, uint256 rewardDebt, uint256 pendingRewards, uint256 lastStakeTime))',
  'function pendingReward(uint256, address) view returns (uint256)',
  'function deposit(uint256, uint256)',
  'function withdraw(uint256, uint256)',
  'function claimRewards(uint256)',
  'event Deposit(address indexed user, uint256 indexed poolId, uint256 amount)',
  'event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount)',
  'event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 reward)'
];

const CATAKLISM_VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function shareValue() view returns (uint256)',
  'function calculateShares(uint256) view returns (uint256)',
  'function calculateAmount(uint256) view returns (uint256)',
  'function getUserInfo(address) view returns (tuple(uint256 shares, uint256 balance, uint256 lastDeposit))',
  'function getVaultStats() view returns (tuple(uint256 totalAssets, uint256 totalShares, uint256 shareValue, uint256 totalReturns, uint256 allTimeHigh, uint256 maxDrawdown))',
  'function deposit(uint256)',
  'function withdraw(uint256)',
  'event Deposit(address indexed user, uint256 amount, uint256 shares)',
  'event Withdraw(address indexed user, uint256 amount, uint256 shares)'
];

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  apiKey: string;
}

export interface ContractInfo {
  address: string;
  abi: string[];
  network: string;
}

export interface TransactionResult {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  status: boolean;
  events?: any[];
}

export interface PoolInfo {
  id: number;
  token: string;
  totalLiquidity: string;
  rewardRate: string;
  lastUpdateTime: number;
  accRewardPerShare: string;
  isActive: boolean;
}

export interface UserStakeInfo {
  amount: string;
  rewardDebt: string;
  pendingRewards: string;
  lastStakeTime: number;
}

export interface VaultStats {
  totalAssets: string;
  totalShares: string;
  shareValue: string;
  totalReturns: string;
  allTimeHigh: string;
  maxDrawdown: string;
}

class BlockchainService extends EventEmitter {
  private providers: Map<string, JsonRpcProvider> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private wallet: ethers.Wallet;
  private cache: CacheService;
  private isInitialized = false;

  constructor() {
    super();
    this.cache = new CacheService();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize providers for each network
      for (const [networkName, networkConfig] of Object.entries(config.NETWORKS)) {
        const provider = new JsonRpcProvider(networkConfig.rpcUrl);
        this.providers.set(networkName, provider);
        logger.info(`Initialized provider for ${networkConfig.name}`);
      }

      // Initialize wallet
      this.wallet = new ethers.Wallet(config.SECURITY.PRIVATE_KEY);

      // Initialize contracts
      await this.initializeContracts();

      // Start event listeners
      this.startEventListeners();

      this.isInitialized = true;
      logger.info('Blockchain service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  private async initializeContracts(): Promise<void> {
    const ethereumProvider = this.providers.get('ethereum');
    if (!ethereumProvider) throw new Error('Ethereum provider not found');

    // Initialize token contract
    const tokenContract = new Contract(
      config.CONTRACTS.CATAKLISM_TOKEN,
      CATAKLISM_TOKEN_ABI,
      ethereumProvider
    );
    this.contracts.set('token', tokenContract);

    // Initialize core contract
    const coreContract = new Contract(
      config.CONTRACTS.CATAKLISM_CORE,
      CATAKLISM_CORE_ABI,
      ethereumProvider
    );
    this.contracts.set('core', coreContract);

    // Initialize vault contract
    const vaultContract = new Contract(
      config.CONTRACTS.CATAKLISM_VAULT,
      CATAKLISM_VAULT_ABI,
      ethereumProvider
    );
    this.contracts.set('vault', vaultContract);

    logger.info('Contracts initialized successfully');
  }

  private startEventListeners(): void {
    const coreContract = this.contracts.get('core');
    const vaultContract = this.contracts.get('vault');
    const tokenContract = this.contracts.get('token');

    if (coreContract) {
      // Listen to staking events
      coreContract.on('Deposit', (user, poolId, amount, event) => {
        this.emit('staking:deposit', { user, poolId, amount, event });
        this.cache.delete(`user:${user}:pools`);
      });

      coreContract.on('Withdraw', (user, poolId, amount, event) => {
        this.emit('staking:withdraw', { user, poolId, amount, event });
        this.cache.delete(`user:${user}:pools`);
      });

      coreContract.on('RewardsClaimed', (user, poolId, reward, event) => {
        this.emit('staking:claim', { user, poolId, reward, event });
        this.cache.delete(`user:${user}:pools`);
      });
    }

    if (vaultContract) {
      // Listen to vault events
      vaultContract.on('Deposit', (user, amount, shares, event) => {
        this.emit('vault:deposit', { user, amount, shares, event });
        this.cache.delete(`vault:stats`);
      });

      vaultContract.on('Withdraw', (user, amount, shares, event) => {
        this.emit('vault:withdraw', { user, amount, shares, event });
        this.cache.delete(`vault:stats`);
      });
    }

    if (tokenContract) {
      // Listen to token transfers
      tokenContract.on('Transfer', (from, to, value, event) => {
        this.emit('token:transfer', { from, to, value, event });
      });
    }

    logger.info('Event listeners started');
  }

  // Token methods
  async getTokenBalance(address: string): Promise<string> {
    const cacheKey = `balance:${address}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tokenContract = this.contracts.get('token');
    if (!tokenContract) throw new Error('Token contract not initialized');

    const balance = await tokenContract.balanceOf(address);
    const result = balance.toString();

    await this.cache.set(cacheKey, result, config.CACHE_TTL.SHORT);
    return result;
  }

  async getTotalSupply(): Promise<string> {
    const cacheKey = 'token:totalSupply';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tokenContract = this.contracts.get('token');
    if (!tokenContract) throw new Error('Token contract not initialized');

    const totalSupply = await tokenContract.totalSupply();
    const result = totalSupply.toString();

    await this.cache.set(cacheKey, result, config.CACHE_TTL.MEDIUM);
    return result;
  }

  // Core protocol methods
  async getPoolInfo(poolId: number): Promise<PoolInfo> {
    const cacheKey = `pool:${poolId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const coreContract = this.contracts.get('core');
    if (!coreContract) throw new Error('Core contract not initialized');

    const poolData = await coreContract.pools(poolId);
    const result: PoolInfo = {
      id: poolId,
      token: poolData.token,
      totalLiquidity: poolData.totalLiquidity.toString(),
      rewardRate: poolData.rewardRate.toString(),
      lastUpdateTime: poolData.lastUpdateTime.toNumber(),
      accRewardPerShare: poolData.accRewardPerShare.toString(),
      isActive: poolData.isActive
    };

    await this.cache.set(cacheKey, JSON.stringify(result), config.CACHE_TTL.MEDIUM);
    return result;
  }

  async getUserStakeInfo(poolId: number, userAddress: string): Promise<UserStakeInfo> {
    const cacheKey = `user:${userAddress}:pool:${poolId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const coreContract = this.contracts.get('core');
    if (!coreContract) throw new Error('Core contract not initialized');

    const userInfo = await coreContract.userInfo(poolId, userAddress);
    const pendingReward = await coreContract.pendingReward(poolId, userAddress);

    const result: UserStakeInfo = {
      amount: userInfo.amount.toString(),
      rewardDebt: userInfo.rewardDebt.toString(),
      pendingRewards: pendingReward.toString(),
      lastStakeTime: userInfo.lastStakeTime.toNumber()
    };

    await this.cache.set(cacheKey, JSON.stringify(result), config.CACHE_TTL.SHORT);
    return result;
  }

  async getTotalValueLocked(): Promise<string> {
    const cacheKey = 'protocol:tvl';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const coreContract = this.contracts.get('core');
    if (!coreContract) throw new Error('Core contract not initialized');

    const tvl = await coreContract.totalValueLocked();
    const result = tvl.toString();

    await this.cache.set(cacheKey, result, config.CACHE_TTL.MEDIUM);
    return result;
  }

  async getPoolCount(): Promise<number> {
    const cacheKey = 'protocol:poolCount';
    const cached = await this.cache.get(cacheKey);
    if (cached) return parseInt(cached);

    const coreContract = this.contracts.get('core');
    if (!coreContract) throw new Error('Core contract not initialized');

    const count = await coreContract.poolCount();
    const result = count.toNumber();

    await this.cache.set(cacheKey, result.toString(), config.CACHE_TTL.LONG);
    return result;
  }

  // Vault methods
  async getVaultStats(): Promise<VaultStats> {
    const cacheKey = 'vault:stats';
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const vaultContract = this.contracts.get('vault');
    if (!vaultContract) throw new Error('Vault contract not initialized');

    const stats = await vaultContract.getVaultStats();
    const result: VaultStats = {
      totalAssets: stats.totalAssets.toString(),
      totalShares: stats.totalShares.toString(),
      shareValue: stats.shareValue.toString(),
      totalReturns: stats.totalReturns.toString(),
      allTimeHigh: stats.allTimeHigh.toString(),
      maxDrawdown: stats.maxDrawdown.toString()
    };

    await this.cache.set(cacheKey, JSON.stringify(result), config.CACHE_TTL.MEDIUM);
    return result;
  }

  async getUserVaultInfo(userAddress: string): Promise<{
    shares: string;
    balance: string;
    lastDeposit: number;
  }> {
    const cacheKey = `user:${userAddress}:vault`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const vaultContract = this.contracts.get('vault');
    if (!vaultContract) throw new Error('Vault contract not initialized');

    const userInfo = await vaultContract.getUserInfo(userAddress);
    const result = {
      shares: userInfo.shares.toString(),
      balance: userInfo.balance.toString(),
      lastDeposit: userInfo.lastDeposit.toNumber()
    };

    await this.cache.set(cacheKey, JSON.stringify(result), config.CACHE_TTL.SHORT);
    return result;
  }

  // Transaction methods
  async executeTransaction(
    contractName: string,
    methodName: string,
    params: any[],
    userAddress: string,
    gasLimit?: number
  ): Promise<TransactionResult> {
    if (!this.isInitialized) {
      throw new Error('Blockchain service not initialized');
    }

    const contract = this.contracts.get(contractName);
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }

    const provider = this.providers.get('ethereum');
    if (!provider) {
      throw new Error('Provider not found');
    }

    const connectedWallet = this.wallet.connect(provider);
    const contractWithSigner = contract.connect(connectedWallet);

    try {
      // Estimate gas if not provided
      const estimatedGas = gasLimit || await contractWithSigner[methodName].estimateGas(...params);

      // Execute transaction
      const tx = await contractWithSigner[methodName](...params, {
        gasLimit: estimatedGas
      });

      // Wait for confirmation
      const receipt = await tx.wait(config.SYNC.BLOCK_CONFIRMATIONS);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1,
        events: receipt.events
      };

    } catch (error) {
      logger.error(`Transaction failed for ${contractName}.${methodName}:`, error);
      throw error;
    }
  }

  // Network utilities
  async getGasPrice(network: string = 'ethereum'): Promise<string> {
    const provider = this.providers.get(network);
    if (!provider) throw new Error(`Provider for ${network} not found`);

    const gasPrice = await provider.getFeeData();
    return gasPrice.gasPrice?.toString() || '0';
  }

  async getBlockNumber(network: string = 'ethereum'): Promise<number> {
    const provider = this.providers.get(network);
    if (!provider) throw new Error(`Provider for ${network} not found`);

    return await provider.getBlockNumber();
  }

  // Cache management
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.deletePattern(pattern);
    } else {
      await this.cache.clear();
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    networks: Record<string, boolean>;
    contracts: Record<string, boolean>;
  }> {
    const networkStatus: Record<string, boolean> = {};
    const contractStatus: Record<string, boolean> = {};

    // Check network connectivity
    for (const [name, provider] of this.providers) {
      try {
        await provider.getBlockNumber();
        networkStatus[name] = true;
      } catch {
        networkStatus[name] = false;
      }
    }

    // Check contract accessibility
    for (const [name, contract] of this.contracts) {
      try {
        await contract.address;
        contractStatus[name] = true;
      } catch {
        contractStatus[name] = false;
      }
    }

    const allNetworksHealthy = Object.values(networkStatus).every(status => status);
    const allContractsHealthy = Object.values(contractStatus).every(status => status);

    return {
      status: allNetworksHealthy && allContractsHealthy ? 'healthy' : 'unhealthy',
      networks: networkStatus,
      contracts: contractStatus
    };
  }
}

// Singleton instance
const blockchainService = new BlockchainService();

export const initializeBlockchainService = async (): Promise<void> => {
  await blockchainService.initialize();
};

export { blockchainService };
