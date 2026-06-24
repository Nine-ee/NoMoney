// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./ProjectToken.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Crowdfunding is ReentrancyGuard {
    // ============ 核心状态变量 ============
    address public immutable i_owner;      // 项目发起者地址
    uint256 public immutable s_goal;       // 众筹目标金额（wei）
    uint256 public s_deadline;             // 众筹截止时间戳（可被提前结束修改）
    uint256 public s_raisedAmount;         // 已筹集金额
    bool public s_isSuccessful;            // 众筹是否成功
    bool public s_isWithdrawn;             // 资金是否已被提取

    // 投资者记录
    mapping(address => uint256) public s_investors;        // 投资者 -> 投资金额
    mapping(address => bool) public s_hasRefunded;         // 投资者 -> 是否已退款
    address[] public s_investorAddresses;                   // 所有投资者地址列表

    // 代币合约实例
    ProjectToken public s_token;

    // ============ 早鸟机制 ============
    uint256 public s_earlyBirdLimit;           // 早鸟名额上限
    uint256 public s_earlyBirdBonusRate;       // 早鸟奖励比例（基点，如 2000 = 20%）
    uint256 public s_currentEarlyBirdCount;    // 当前早鸟已用名额
    mapping(address => bool) public s_isEarlyBird;  // 是否为早鸟投资者

    // ============ 冷静期/退款机制 ============
    uint256 public s_refundDeadline;                 // 退款截止时间（从未使用，保留）
    uint256 public constant COOLDOWN_PERIOD = 7 days; // 冷静期：成功后 7 天内可退款

    event Invested(address indexed investor, uint256 amount, uint256 tokenAmount, bool isEarlyBird);
    event Refunded(address indexed investor, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event CampaignFinalized(bool success);

    // ============ 权限修饰器 ============
    modifier onlyOwner() {
        require(msg.sender == i_owner, "Only project owner can call");
        _;
    }

    modifier campaignOngoing() {
        require(block.timestamp < s_deadline, "Campaign has ended");
        _;
    }

    modifier campaignEnded() {
        require(block.timestamp >= s_deadline, "Campaign has not ended yet");
        _;
    }

    constructor(
        uint256 goal,
        uint256 durationInSeconds,
        address tokenAddress,
        uint256 earlyBirdLimit,
        uint256 earlyBirdBonusRate
    ) {
        require(goal > 0, "Goal must be positive");
        require(tokenAddress != address(0), "Invalid token address");

        i_owner = msg.sender;
        s_goal = goal;
        s_deadline = block.timestamp + durationInSeconds;
        s_token = ProjectToken(tokenAddress);
        s_earlyBirdLimit = earlyBirdLimit;
        s_earlyBirdBonusRate = earlyBirdBonusRate;
        s_isSuccessful = false;
        s_isWithdrawn = false;
    }

    // ============ 投资函数：用户投入 ETH 获得代币 ============
    function invest() public payable campaignOngoing nonReentrant {
        require(msg.value > 0, "Investment must be greater than 0");

        // 基础兑换比例：1 ETH = 10,000 代币
        uint256 baseTokenAmount = (msg.value * 10000 * 1e18) / 1e18;
        uint256 tokenAmount = baseTokenAmount;

        // 早鸟奖励：前 N 名首次投资者获得额外代币
        bool isEarlyBirdInvestor = false;
        if (s_currentEarlyBirdCount < s_earlyBirdLimit && s_investors[msg.sender] == 0) {
            isEarlyBirdInvestor = true;
            s_isEarlyBird[msg.sender] = true;
            s_currentEarlyBirdCount++;
            tokenAmount = (baseTokenAmount * (10000 + s_earlyBirdBonusRate)) / 10000;
        }

        // 首次投资者加入地址列表
        if (s_investors[msg.sender] == 0) {
            s_investorAddresses.push(msg.sender);
        }

        s_investors[msg.sender] += msg.value;
        s_raisedAmount += msg.value;

        // 铸造代币发放给投资者
        s_token.mint(msg.sender, tokenAmount);

        emit Invested(msg.sender, msg.value, tokenAmount, isEarlyBirdInvestor);

        // 达到目标自动标记成功
        if (s_raisedAmount >= s_goal) {
            s_isSuccessful = true;
            emit CampaignFinalized(true);
        }
    }

    // ============ 结束众筹：任何人在截止后都可调用，判定最终结果 ============
    function finalizeCampaign() public campaignEnded {
        require(!s_isSuccessful, "Campaign already finalized");

        if (s_raisedAmount >= s_goal) {
            s_isSuccessful = true;
        }

        emit CampaignFinalized(s_isSuccessful);
    }

    // ============ 提取资金：仅项目所有者，众筹成功后提取 ETH ============
    function withdrawFunds() public onlyOwner campaignEnded nonReentrant {
        require(s_isSuccessful, "Campaign is not successful");
        require(!s_isWithdrawn, "Funds already withdrawn");
        require(address(this).balance > 0, "No funds to withdraw");

        s_isWithdrawn = true;
        (bool success, ) = i_owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");

        emit Withdrawn(i_owner, address(this).balance);
    }

    // ============ 退款：众筹失败或冷静期内，投资者可退款 ============
    function refund() public campaignEnded nonReentrant {
        require(!s_hasRefunded[msg.sender], "Already refunded");

        uint256 amountInvested = s_investors[msg.sender];
        require(amountInvested > 0, "No investment to refund");

        // 退款条件：众筹失败，或成功但仍在冷静期
        bool canRefund;
        if (!s_isSuccessful) {
            canRefund = true;  // 众筹失败，无条件退款
        } else {
            canRefund = (block.timestamp <= s_deadline + COOLDOWN_PERIOD);  // 冷静期内
        }
        require(canRefund, "Refund period expired");

        s_hasRefunded[msg.sender] = true;
        s_investors[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amountInvested}("");
        require(success, "Refund failed");

        emit Refunded(msg.sender, amountInvested);
    }

    // ============ 查询函数 ============

    // 检查用户是否可以退款
    function canUserRefund(address user) public view returns (bool, string memory) {
        if (block.timestamp < s_deadline) return (false, "Campaign has not ended yet");
        if (s_hasRefunded[user]) return (false, "Already refunded");
        if (s_investors[user] == 0) return (false, "No investment");

        if (!s_isSuccessful) return (true, "Campaign failed, can refund");
        if (block.timestamp <= s_deadline + COOLDOWN_PERIOD) return (true, "During cooldown period");

        return (false, "Refund period expired");
    }

    // 获取冷静期剩余时间
    function getCooldownInfo() public view returns (uint256 remainingTime, bool isActive) {
        if (block.timestamp > s_deadline + COOLDOWN_PERIOD || !s_isSuccessful) {
            return (0, false);
        }
        return (s_deadline + COOLDOWN_PERIOD - block.timestamp, true);
    }

    // 获取众筹剩余时间（秒）
    function getRemainingTime() public view returns (uint256) {
        if (block.timestamp >= s_deadline) return 0;
        return s_deadline - block.timestamp;
    }

    function getCampaignInfo() public view returns (
        uint256 target,
        uint256 raised,
        uint256 remaining,
        uint256 participantCount,
        bool isSuccessful,
        uint256 earlyBirdRemaining
    ) {
        return (
            s_goal,
            s_raisedAmount,
            block.timestamp >= s_deadline ? 0 : s_deadline - block.timestamp,
            s_investorAddresses.length,
            s_isSuccessful,
            s_earlyBirdLimit > s_currentEarlyBirdCount ? s_earlyBirdLimit - s_currentEarlyBirdCount : 0
        );
    }

    function getContributors() public view returns (address[] memory) {
        return s_investorAddresses;
    }

    function getInvestorCount() public view returns (uint256) {
        return s_investorAddresses.length;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getGoal() public view returns (uint256) {
        return s_goal;
    }

    function getDeadline() public view returns (uint256) {
        return s_deadline;
    }

    function getRaisedAmount() public view returns (uint256) {
        return s_raisedAmount;
    }

    function getIsSuccessful() public view returns (bool) {
        return s_isSuccessful;
    }

    function getEarlyBirdLimit() public view returns (uint256) {
        return s_earlyBirdLimit;
    }

    function getEarlyBirdBonusRate() public view returns (uint256) {
        return s_earlyBirdBonusRate;
    }

    // 获取项目发起者地址
    function getOwner() public view returns (address) {
        return i_owner;
    }

    // 获取资金是否已被提取
    function getIsWithdrawn() public view returns (bool) {
        return s_isWithdrawn;
    }

    // 提前结束众筹（仅项目所有者）
    function endCampaignEarly() public onlyOwner campaignOngoing {
        s_deadline = block.timestamp;
        if (s_raisedAmount >= s_goal) {
            s_isSuccessful = true;
        }
        emit CampaignFinalized(s_isSuccessful);
    }

    receive() external payable {
        this.invest();
    }
}