const { expect } = require("chai");
const { ethers } = require("hardhat");

// 众筹项目完整测试
describe("众筹项目完整测试", function () {
  let crowdfunding, token, owner, user1, user2, user3;
  const GOAL = ethers.utils.parseEther("10");       // 目标 10 ETH
  const DURATION = 60 * 60 * 24 * 7;                 // 7天
  const EARLY_BIRD_LIMIT = 2;                         // 前2名早鸟
  const EARLY_BIRD_BONUS = 2000;                      // 额外20%奖励

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // 部署代币合约
    const Token = await ethers.getContractFactory("ProjectToken");
    token = await Token.deploy();
    await token.deployed();

    // 部署众筹合约
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    crowdfunding = await Crowdfunding.deploy(
      GOAL,
      DURATION,
      token.address,
      EARLY_BIRD_LIMIT,
      EARLY_BIRD_BONUS
    );
    await crowdfunding.deployed();

    // 授权众筹合约铸造代币
    await token.setCrowdfundingAddress(crowdfunding.address);
  });

  // ============ 1. 基础投资功能 ============
  describe("1. 基础投资功能", function () {
    it("应该能接受ETH投资并立即铸造代币", async function () {
      const amount = ethers.utils.parseEther("1");
      await crowdfunding.connect(user1).invest({ value: amount });

      // 已筹金额正确
      expect(await crowdfunding.s_raisedAmount()).to.equal(amount);
      // 立即获得代币：1 ETH = 10000 XXCT，但 user1 是第一个投资者所以是早鸟得到 12000
      expect(await token.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("12000"));
    });

    it("投资额为0应该失败", async function () {
      await expect(
        crowdfunding.connect(user1).invest({ value: 0 })
      ).to.be.revertedWith("Investment must be greater than 0");
    });

    it("众筹结束后不能投资", async function () {
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await expect(
        crowdfunding.connect(user1).invest({ value: 1 })
      ).to.be.revertedWith("Campaign has ended");
    });
  });

  // ============ 2. 早鸟奖励功能 ============
  describe("2. 早鸟奖励功能", function () {
    it("前2名投资者应该获得早鸟标记", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });

      expect(await crowdfunding.s_isEarlyBird(user1.address)).to.be.true;
      expect(await crowdfunding.s_isEarlyBird(user2.address)).to.be.true;
    });

    it("第3名投资者不应该获得早鸟标记", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user3).invest({ value: ethers.utils.parseEther("1") });

      expect(await crowdfunding.s_isEarlyBird(user3.address)).to.be.false;
    });

    it("早鸟应获得额外代币奖励（12000 = 10000基础 + 2000奖励）", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      // 早鸟：10000 * 1.2 = 12000 XXCT（带18位精度）
      expect(await token.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("12000"));
    });

    it("非早鸟获得基础代币（10000 XXCT）", async function () {
      // 前2名占满早鸟名额
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(user2).invest({ value: ethers.utils.parseEther("1") });
      // 第3名非早鸟
      await crowdfunding.connect(user3).invest({ value: ethers.utils.parseEther("1") });

      expect(await token.balanceOf(user3.address)).to.equal(ethers.utils.parseEther("10000"));
    });
  });

  // ============ 3. 退款功能 ============
  describe("3. 退款功能", function () {
    it("众筹失败后可以退款（未达目标）", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });

      // 快进到众筹结束
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await crowdfunding.connect(user1).refund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // 余额应恢复（减去gas费）
      expect(balanceAfter.add(gasCost).sub(balanceBefore)).to.equal(ethers.utils.parseEther("1"));
    });

    it("众筹成功后冷静期内可以退款", async function () {
      // 投资达到目标
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("10") });

      // 快进到众筹结束，但仍在冷静期内
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      // 冷静期内可以退款
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await crowdfunding.connect(user1).refund();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter.add(gasCost).sub(balanceBefore)).to.equal(ethers.utils.parseEther("10"));
    });

    it("冷静期结束后不能退款", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("10") });

      // 跳过众筹期 + 冷静期（7天 + 1秒）
      await ethers.provider.send("evm_increaseTime", [DURATION + 7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      await expect(
        crowdfunding.connect(user1).refund()
      ).to.be.revertedWith("Refund period expired");
    });

    it("不能重复退款", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();
      await crowdfunding.connect(user1).refund();

      await expect(
        crowdfunding.connect(user1).refund()
      ).to.be.revertedWith("Already refunded");
    });
  });

  // ============ 4. 提取资金 ============
  describe("4. 提取资金", function () {
    it("项目方可以在众筹成功后提取资金", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("10") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await crowdfunding.connect(owner).withdrawFunds();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter.add(gasCost).sub(balanceBefore)).to.equal(ethers.utils.parseEther("10"));
    });

    it("非项目方不能提取资金", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("10") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      await expect(
        crowdfunding.connect(user1).withdrawFunds()
      ).to.be.revertedWith("Only project owner can call");
    });
  });

  // ============ 5. 辅助查询功能 ============
  describe("5. 辅助查询功能", function () {
    it("getCampaignInfo 返回正确信息", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("5") });

      const info = await crowdfunding.getCampaignInfo();
      expect(info.raised).to.equal(ethers.utils.parseEther("5"));
      expect(info.target).to.equal(ethers.utils.parseEther("10"));
      expect(info.participantCount).to.equal(1);
      expect(info.earlyBirdRemaining).to.equal(1); // 还剩1个早鸟名额
    });

    it("canUserRefund 返回正确状态", async function () {
      await crowdfunding.connect(user1).invest({ value: ethers.utils.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine");
      await crowdfunding.finalizeCampaign();

      const [canRefund, reason] = await crowdfunding.canUserRefund(user1.address);
      expect(canRefund).to.be.true;
      expect(reason).to.equal("Campaign failed, can refund");
    });
  });
});