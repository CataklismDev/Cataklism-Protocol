const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CataklismCore", function () {
  // Fixture for deployment
  async function deployProtocolFixture() {
    const [owner, treasury, emergencyDAO, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    const stakingToken = await MockToken.deploy("Staking Token", "STK", ethers.utils.parseEther("1000000"));

    // Deploy Cataklism Token
    const CataklismToken = await ethers.getContractFactory("CataklismToken");
    const cataklismToken = await CataklismToken.deploy(
      treasury.address,
      owner.address,
      owner.address
    );

    // Deploy Cataklism Core
    const CataklismCore = await ethers.getContractFactory("CataklismCore");
    const cataklismCore = await CataklismCore.deploy(
      cataklismToken.address,
      treasury.address,
      emergencyDAO.address
    );

    // Grant minter role to core contract
    const MINTER_ROLE = await cataklismToken.MINTER_ROLE();
    await cataklismToken.grantRole(MINTER_ROLE, cataklismCore.address);

    // Mint test tokens to users
    await stakingToken.transfer(user1.address, ethers.utils.parseEther("1000"));
    await stakingToken.transfer(user2.address, ethers.utils.parseEther("1000"));
    await stakingToken.transfer(user3.address, ethers.utils.parseEther("1000"));

    // Mint reward tokens to core contract
    await cataklismToken.mint(cataklismCore.address, ethers.utils.parseEther("100000"));

    return {
      cataklismCore,
      cataklismToken,
      stakingToken,
      owner,
      treasury,
      emergencyDAO,
      user1,
      user2,
      user3,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      const { cataklismCore, cataklismToken, treasury, emergencyDAO } = await loadFixture(deployProtocolFixture);

      expect(await cataklismCore.cataklismToken()).to.equal(cataklismToken.address);
      expect(await cataklismCore.treasury()).to.equal(treasury.address);
      expect(await cataklismCore.emergencyDAO()).to.equal(emergencyDAO.address);
      expect(await cataklismCore.poolCount()).to.equal(0);
      expect(await cataklismCore.totalValueLocked()).to.equal(0);
      expect(await cataklismCore.protocolFee()).to.equal(250); // 2.5%
      expect(await cataklismCore.emergencyPaused()).to.equal(false);
    });

    it("Should not deploy with zero addresses", async function () {
      const CataklismCore = await ethers.getContractFactory("CataklismCore");

      await expect(
        CataklismCore.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid token address");
    });
  });

  describe("Pool Management", function () {
    it("Should add a new pool correctly", async function () {
      const { cataklismCore, stakingToken, owner } = await loadFixture(deployProtocolFixture);

      const rewardRate = ethers.utils.parseEther("100"); // 100 tokens per second

      await expect(cataklismCore.addPool(stakingToken.address, rewardRate, false))
        .to.emit(cataklismCore, "PoolAdded")
        .withArgs(0, stakingToken.address, rewardRate);

      expect(await cataklismCore.poolCount()).to.equal(1);

      const poolInfo = await cataklismCore.pools(0);
      expect(poolInfo.token).to.equal(stakingToken.address);
      expect(poolInfo.rewardRate).to.equal(rewardRate);
      expect(poolInfo.totalLiquidity).to.equal(0);
      expect(poolInfo.isActive).to.equal(true);
    });

    it("Should not allow non-owner to add pools", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(deployProtocolFixture);

      await expect(
        cataklismCore.connect(user1).addPool(stakingToken.address, ethers.utils.parseEther("100"), false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not add pool with invalid parameters", async function () {
      const { cataklismCore, stakingToken } = await loadFixture(deployProtocolFixture);

      // Invalid token address
      await expect(
        cataklismCore.addPool(ethers.constants.AddressZero, ethers.utils.parseEther("100"), false)
      ).to.be.revertedWith("Invalid token");

      // Invalid reward rate
      await expect(
        cataklismCore.addPool(stakingToken.address, 0, false)
      ).to.be.revertedWith("Invalid reward rate");
    });
  });

  describe("Staking Operations", function () {
    async function setupPoolFixture() {
      const fixture = await loadFixture(deployProtocolFixture);
      const { cataklismCore, stakingToken } = fixture;

      // Add a pool
      const rewardRate = ethers.utils.parseEther("100");
      await cataklismCore.addPool(stakingToken.address, rewardRate, false);

      return { ...fixture, rewardRate };
    }

    it("Should allow users to deposit tokens", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");

      // Approve tokens
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);

      // Deposit
      await expect(cataklismCore.connect(user1).deposit(0, depositAmount))
        .to.emit(cataklismCore, "Deposit")
        .withArgs(user1.address, 0, depositAmount);

      // Check user info
      const userInfo = await cataklismCore.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(depositAmount);
      expect(userInfo.rewardDebt).to.equal(0); // First deposit, no rewards yet

      // Check pool info
      const poolInfo = await cataklismCore.pools(0);
      expect(poolInfo.totalLiquidity).to.equal(depositAmount);

      // Check total value locked
      expect(await cataklismCore.totalValueLocked()).to.equal(depositAmount);
    });

    it("Should calculate rewards correctly", async function () {
      const { cataklismCore, stakingToken, user1, rewardRate } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");

      // Approve and deposit
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);
      await cataklismCore.connect(user1).deposit(0, depositAmount);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine");

      // Check pending rewards
      const pendingReward = await cataklismCore.pendingReward(0, user1.address);
      const expectedReward = rewardRate.mul(3600); // rewardRate * time

      expect(pendingReward).to.be.closeTo(expectedReward, ethers.utils.parseEther("1"));
    });

    it("Should allow users to withdraw tokens", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");
      const withdrawAmount = ethers.utils.parseEther("50");

      // Deposit first
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);
      await cataklismCore.connect(user1).deposit(0, depositAmount);

      // Fast forward time for rewards
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      const initialBalance = await stakingToken.balanceOf(user1.address);

      // Withdraw
      await expect(cataklismCore.connect(user1).withdraw(0, withdrawAmount))
        .to.emit(cataklismCore, "Withdraw")
        .withArgs(user1.address, 0, withdrawAmount);

      // Check balances
      const finalBalance = await stakingToken.balanceOf(user1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(withdrawAmount);

      // Check user info
      const userInfo = await cataklismCore.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(depositAmount.sub(withdrawAmount));
    });

    it("Should allow users to claim rewards", async function () {
      const { cataklismCore, cataklismToken, stakingToken, user1, treasury } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");

      // Deposit
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);
      await cataklismCore.connect(user1).deposit(0, depositAmount);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      const initialBalance = await cataklismToken.balanceOf(user1.address);
      const initialTreasuryBalance = await cataklismToken.balanceOf(treasury.address);

      // Claim rewards
      await expect(cataklismCore.connect(user1).claimRewards(0))
        .to.emit(cataklismCore, "RewardsClaimed");

      // Check balances
      const finalBalance = await cataklismToken.balanceOf(user1.address);
      const finalTreasuryBalance = await cataklismToken.balanceOf(treasury.address);

      expect(finalBalance).to.be.gt(initialBalance);
      expect(finalTreasuryBalance).to.be.gt(initialTreasuryBalance); // Protocol fee
    });

    it("Should not allow withdrawal of more than staked", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");
      const withdrawAmount = ethers.utils.parseEther("150");

      // Deposit
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);
      await cataklismCore.connect(user1).deposit(0, depositAmount);

      // Try to withdraw more than deposited
      await expect(
        cataklismCore.connect(user1).withdraw(0, withdrawAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should handle emergency withdrawal", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(setupPoolFixture);
      const depositAmount = ethers.utils.parseEther("100");

      // Deposit
      await stakingToken.connect(user1).approve(cataklismCore.address, depositAmount);
      await cataklismCore.connect(user1).deposit(0, depositAmount);

      const initialBalance = await stakingToken.balanceOf(user1.address);

      // Emergency withdraw
      await expect(cataklismCore.connect(user1).emergencyWithdraw(0))
        .to.emit(cataklismCore, "EmergencyWithdraw")
        .withArgs(user1.address, 0, depositAmount);

      // Check balance returned
      const finalBalance = await stakingToken.balanceOf(user1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(depositAmount);

      // Check user info is reset
      const userInfo = await cataklismCore.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(0);
      expect(userInfo.rewardDebt).to.equal(0);
      expect(userInfo.pendingRewards).to.equal(0);
    });
  });

  describe("Multiple Users", function () {
    async function setupMultiUserFixture() {
      const fixture = await loadFixture(deployProtocolFixture);
      const { cataklismCore, stakingToken } = fixture;

      // Add a pool
      const rewardRate = ethers.utils.parseEther("100");
      await cataklismCore.addPool(stakingToken.address, rewardRate, false);

      return { ...fixture, rewardRate };
    }

    it("Should distribute rewards proportionally", async function () {
      const { cataklismCore, stakingToken, user1, user2 } = await loadFixture(setupMultiUserFixture);

      const user1Deposit = ethers.utils.parseEther("200");
      const user2Deposit = ethers.utils.parseEther("100");

      // User1 deposits first
      await stakingToken.connect(user1).approve(cataklismCore.address, user1Deposit);
      await cataklismCore.connect(user1).deposit(0, user1Deposit);

      // Fast forward 1 hour
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      // User2 deposits
      await stakingToken.connect(user2).approve(cataklismCore.address, user2Deposit);
      await cataklismCore.connect(user2).deposit(0, user2Deposit);

      // Fast forward another hour
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      // Check rewards
      const user1Rewards = await cataklismCore.pendingReward(0, user1.address);
      const user2Rewards = await cataklismCore.pendingReward(0, user2.address);

      // User1 should have more rewards (deposited earlier and larger amount)
      expect(user1Rewards).to.be.gt(user2Rewards);

      // The ratio should reflect the deposit amounts for the second hour
      const ratio = user1Rewards.div(user2Rewards);
      expect(ratio).to.be.closeTo(ethers.BigNumber.from(2), ethers.BigNumber.from(1));
    });
  });

  describe("Admin Functions", function () {
    async function setupAdminFixture() {
      const fixture = await loadFixture(deployProtocolFixture);
      return fixture;
    }

    it("Should allow owner to update protocol fee", async function () {
      const { cataklismCore, owner } = await loadFixture(setupAdminFixture);
      const newFee = 500; // 5%

      await expect(cataklismCore.setProtocolFee(newFee))
        .to.emit(cataklismCore, "ProtocolFeeUpdated")
        .withArgs(250, newFee);

      expect(await cataklismCore.protocolFee()).to.equal(newFee);
    });

    it("Should not allow setting fee above maximum", async function () {
      const { cataklismCore } = await loadFixture(setupAdminFixture);
      const maxFee = await cataklismCore.MAX_FEE();

      await expect(
        cataklismCore.setProtocolFee(maxFee.add(1))
      ).to.be.revertedWith("Fee too high");
    });

    it("Should allow emergency pause", async function () {
      const { cataklismCore, emergencyDAO } = await loadFixture(setupAdminFixture);

      await cataklismCore.connect(emergencyDAO).pauseProtocol(true);
      expect(await cataklismCore.emergencyPaused()).to.equal(true);

      // Should not allow deposits when paused
      const { stakingToken, user1 } = await loadFixture(setupAdminFixture);
      await cataklismCore.addPool(stakingToken.address, ethers.utils.parseEther("100"), false);

      await stakingToken.connect(user1).approve(cataklismCore.address, ethers.utils.parseEther("100"));
      await expect(
        cataklismCore.connect(user1).deposit(0, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Protocol is paused");
    });
  });

  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for operations", async function () {
      const fixture = await loadFixture(deployProtocolFixture);
      const { cataklismCore, stakingToken, user1 } = fixture;

      // Add pool
      const addPoolTx = await cataklismCore.addPool(stakingToken.address, ethers.utils.parseEther("100"), false);
      const addPoolReceipt = await addPoolTx.wait();
      expect(addPoolReceipt.gasUsed).to.be.lt(200000); // Should be less than 200k gas

      // Deposit
      await stakingToken.connect(user1).approve(cataklismCore.address, ethers.utils.parseEther("100"));
      const depositTx = await cataklismCore.connect(user1).deposit(0, ethers.utils.parseEther("100"));
      const depositReceipt = await depositTx.wait();
      expect(depositReceipt.gasUsed).to.be.lt(150000); // Should be less than 150k gas

      // Withdraw
      const withdrawTx = await cataklismCore.connect(user1).withdraw(0, ethers.utils.parseEther("50"));
      const withdrawReceipt = await withdrawTx.wait();
      expect(withdrawReceipt.gasUsed).to.be.lt(100000); // Should be less than 100k gas
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero deposits gracefully", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(deployProtocolFixture);

      await cataklismCore.addPool(stakingToken.address, ethers.utils.parseEther("100"), false);

      await expect(
        cataklismCore.connect(user1).deposit(0, 0)
      ).to.be.revertedWith("Cannot deposit 0");
    });

    it("Should handle pool updates correctly", async function () {
      const { cataklismCore, stakingToken, user1 } = await loadFixture(deployProtocolFixture);

      await cataklismCore.addPool(stakingToken.address, ethers.utils.parseEther("100"), false);

      // Deposit some tokens
      await stakingToken.connect(user1).approve(cataklismCore.address, ethers.utils.parseEther("100"));
      await cataklismCore.connect(user1).deposit(0, ethers.utils.parseEther("100"));

      // Update pool should not affect existing stakes
      const userInfoBefore = await cataklismCore.userInfo(0, user1.address);
      await cataklismCore.updatePool(0);
      const userInfoAfter = await cataklismCore.userInfo(0, user1.address);

      expect(userInfoAfter.amount).to.equal(userInfoBefore.amount);
    });
  });
});
