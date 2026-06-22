const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("众筹项目完整测试（含拓展功能）", function () {
  let crowdfunding, token, owner, user1, user2, user3;
  const GOAL = ethers.utils.parseEther("10");
  const DURATION = 60 * 60 * 24;
  const EARLY_BIRD_LIMIT = 2;
  const EARLY_BIRD_BONUS = 2000; // 20%

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ProjectToken");
    token = await Token.deploy();
    await token.deployed();

    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    crowdfunding = await Crowdfunding.deploy(
      GOAL, 
      DURATION, 
      token.address,
      EARLY_BIRD_LIMIT,
      EARLY_BIRD_BONUS
    );
    await crowdfunding.deployed();

    await token.setCrowdfundingAddress(crowdfunding.address);
  });

  describe("1. 基础投资功能", function () {
    it("应该能接受ETH投资", async function () {
      const amount = ethers.utils.parseEther("1");
      await crowdfunding.connect(user1).invest({ value: amount });
      expect(await crowdfunding.s_raisedAmount()).to.equal(amount);
    });

    it("投资额为0应该失败", async function () {
      await expect(
        crowdfunding.connect(user1).invest({ value: 0 })
      ).to.be.revertedWith("投资额必须大于0");
    });

    it("众筹结束后不能投资", async function () {
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdfunding.connect(user1).invest({ value: 1 })
      ).to.be.revertedWith("众筹已结束");
    });
  });

  describe("2. 早鸟奖励功能", function () {
    it("前2名投资者应该获得早鸟奖励", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });
      
      expect(await crowdfunding.s_isEarlyBird(user1.address)).to.be.true;
      expect(await crowdfunding.s_isEarlyBird(user2.address)).to.be.true;
    });

    it("第3名投资者不应该获得早鸟奖励", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user3).invest({ value: ethers.utils.parseEther("1") });
      
      expect(await crowdfunding.s_isEarlyBird(user3.address)).to.be.false;
    });

    it("早鸟应该获得额外代币奖励", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      // 早鸟获得12000代币（10000基础 + 2000奖励）
      expect(await token.balanceOf(user1.address)).to.equal(12000);
      expect(await token.balanceOf(user2.address)).to.equal(12000);
    });
  });

  describe("3. 冷静期/退款窗口功能", function () {
    it("众筹失败后，退款窗口开启才能退款", async function () {
      // 投资1 ETH（不够目标）
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      // 开启退款窗口（7天）
      await crowdfunding.setRefundWindow(7 * 24 * 60 * 60);

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await crowdfunding.connect(user1).refund();
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("退款窗口关闭后不能退款", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      await crowdfunding.setRefundWindow(7 * 24 * 60 * 60);
      
      // 模拟时间过去8天
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      await expect(
        crowdfunding.connect(user1).refund()
      ).to.be.revertedWith("退款窗口已关闭");
    });
  });

  describe("4. 代币分发功能", function () {
    it("众筹成功后应该正确分发代币", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("5") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("5") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      expect(await token.balanceOf(user1.address)).to.equal(60000); // 50000基础 + 10000早鸟奖励
      expect(await token.balanceOf(user2.address)).to.equal(60000);
    });
  });
});