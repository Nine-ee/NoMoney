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
    bool public s_isSuccessful;            // 众筹是否成功（达到目标）
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
    // 冷静期时长：3 分钟
    // 冷静期开始条件：众筹结束后（两种触发方式）
    //   1. 众筹时间自然结束：block.timestamp >= s_deadline（初始设定的截止时间）
    //   2. 项目发起者手动结束：调用 endCampaignEarly()，将 s_deadline 设置为当前时间
    // 冷静期结束条件：block.timestamp >= s_deadline + COOLDOWN_PERIOD
    // 冷静期内：投资者可申请退款，项目发起者不可提取资金，代币不发放
    // 冷静期结束后：代币自动发放（众筹成功时），项目发起者可提取资金
    uint256 public constant COOLDOWN_PERIOD = 1 minutes; //冷静期时长Time！！！！！！

    // 代币发放状态
    bool public s_tokensDistributed;       // 代币是否已自动发放

    // 待领取代币（冷静期结束后自动发放）
    mapping(address => uint256) public s_pendingTokens;   // 投资者 -> 待领取代币数量
    mapping(address => bool) public s_tokensClaimed;      // 投资者 -> 是否已领取代币（备用）

    event Invested(address indexed investor, uint256 amount, uint256 tokenAmount, bool isEarlyBird);
    event Refunded(address indexed investor, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event TokensClaimed(address indexed investor, uint256 amount);
    event CampaignFinalized(bool success);
    event TokensDistributed(uint256 totalAmount);

    // ============ 权限修饰器 ============
    modifier onlyOwner() {
        require(msg.sender == i_owner, "Only project owner can call");
        _;
    }

    // 众筹进行中：时间未到截止时间
    modifier campaignOngoing() {
        require(block.timestamp < s_deadline, "Campaign has ended");
        _;
    }

    // 众筹已结束：时间已到截止时间（包括自然结束和手动提前结束）
    modifier campaignEnded() {
        require(block.timestamp >= s_deadline, "Campaign has not ended yet");
        _;
    }

    // 冷静期已结束：众筹结束 + 冷静期时间已过
    modifier cooldownEnded() {
        require(block.timestamp >= s_deadline + COOLDOWN_PERIOD, unicode"冷静期已结束");
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
        require(earlyBirdBonusRate <= 5000, "Bonus rate too high"); // 最多50%
        require(earlyBirdBonusRate >= 0, "Bonus rate cannot be negative"); // 不能为负

        i_owner = msg.sender;
        s_goal = goal;
        s_deadline = block.timestamp + durationInSeconds;
        s_token = ProjectToken(tokenAddress);
        s_earlyBirdLimit = earlyBirdLimit;
        s_earlyBirdBonusRate = earlyBirdBonusRate;
        s_isSuccessful = false;
        s_isWithdrawn = false;
        s_tokensDistributed = false;
    }

    // ============ 投资函数：用户投入 ETH，记录投资但不立即发放代币 ============
    // 代币将在冷静期结束后统一发放（通过 claimTokens 领取）
    function invest() public payable campaignOngoing nonReentrant {
        require(msg.value > 0, "Investment must be greater than 0");

        // 基础兑换比例：1 ETH = 10,000 代币
        // 简化计算：msg.value 单位是 wei（1 ETH = 10^18 wei），代币也有 18 位小数
        // 所以 msg.value * 10000 直接得到正确结果
        // 例如：1 ETH → 10^18 wei × 10000 = 10^22，表示 10000 个代币（每个代币 10^18）
        uint256 baseTokenAmount = msg.value * 10000;
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

        // 暂存代币数量，等冷静期结束后再发放
        s_pendingTokens[msg.sender] += tokenAmount;

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

    // ============ 提取资金：仅项目所有者 ============
    // 众筹失败时：不可提取资金，投资者可申请退款
    // 众筹成功时：需等待冷静期结束后才可提取
    function withdrawFunds() public onlyOwner campaignEnded cooldownEnded nonReentrant {
        require(!s_isWithdrawn, "Funds already withdrawn");
        require(s_isSuccessful, "Campaign not successful");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        s_isWithdrawn = true;
        
        (bool success, ) = i_owner.call{value: balance}("");
        require(success, "Transfer failed");

        emit Withdrawn(i_owner, balance);
    }

    // ============ 退款：仅在冷静期内（成功时）或众筹失败时可退款 ============
    // 冷静期过后不支持退款
    function refund() public campaignEnded nonReentrant {
        require(!s_hasRefunded[msg.sender], "Already refunded");

        uint256 amountInvested = s_investors[msg.sender];
        require(amountInvested > 0, "No investment to refund");

        // 退款条件判断
        bool canRefund;
        if (!s_isSuccessful) {
            // 众筹失败，任何时候都可以退款
            canRefund = true;
        } else {
            // 众筹成功，仅在冷静期内可退款
            canRefund = (block.timestamp <= s_deadline + COOLDOWN_PERIOD);
        }
        require(canRefund, "Cooldown period expired");

        s_hasRefunded[msg.sender] = true;
        uint256 refundAmount = s_investors[msg.sender];
        s_investors[msg.sender] = 0;
        s_pendingTokens[msg.sender] = 0;  // 清除待领取代币
        s_raisedAmount -= refundAmount;

        // 退款后检查是否仍满足目标
        if (s_isSuccessful && s_raisedAmount < s_goal) {
            s_isSuccessful = false;
        }

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund failed");

        emit Refunded(msg.sender, refundAmount);
    }

    // ============ 自动发放代币：冷静期结束后，任何人可触发，代币自动发放给所有投资者 ============
    // 代币在冷静期结束后自动发放，不需要投资者手动领取
    // 调用条件：
    //   1. 众筹已结束（自然结束或手动结束）
    //   2. 冷静期已结束
    //   3. 众筹成功
    //   4. 代币尚未发放过
    function distributeTokens() public campaignEnded cooldownEnded nonReentrant {
        require(s_isSuccessful, "Campaign is not successful");
        require(!s_tokensDistributed, "Tokens already distributed");

        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < s_investorAddresses.length; i++) {
            address investor = s_investorAddresses[i];
            if (!s_hasRefunded[investor]) {
                uint256 tokenAmount = s_pendingTokens[investor];
                if (tokenAmount > 0) {
                    s_tokensClaimed[investor] = true;
                    s_token.mint(investor, tokenAmount);
                    totalDistributed += tokenAmount;
                    emit TokensClaimed(investor, tokenAmount);
                }
            }
        }

        s_tokensDistributed = true;
        emit TokensDistributed(totalDistributed);
    }

    // ============ 查询函数 ============

    // 检查用户是否可以退款
    function canUserRefund(address user) public view returns (bool, string memory) {
        if (block.timestamp < s_deadline) return (false, unicode"众筹尚未结束");
        if (s_hasRefunded[user]) return (false, unicode"已退款");
        if (s_investors[user] == 0) return (false, unicode"无投资记录");

        if (!s_isSuccessful) return (true, unicode"众筹失败，可退款");

        if (block.timestamp <= s_deadline + COOLDOWN_PERIOD) {
            return (true, unicode"冷静期中，可退款");
        }
        return (false, unicode"冷静期已过");
    }

    // 检查用户是否可以领取代币
    function canUserClaim(address user) public view returns (bool, string memory) {
        if (block.timestamp <= s_deadline) return (false, unicode"众筹尚未结束");
        if (block.timestamp <= s_deadline + COOLDOWN_PERIOD) return (false, unicode"冷静期尚未结束");
        if (!s_isSuccessful) return (false, unicode"众筹未成功");
        if (s_hasRefunded[user]) return (false, unicode"已退款");
        if (s_tokensClaimed[user]) return (false, unicode"已领取");
        if (s_pendingTokens[user] == 0) return (false, unicode"无待领取代币");
        return (true, unicode"可领取代币");
    }

    // 获取冷静期信息
    // 只有众筹成功时才有冷静期，众筹失败时没有冷静期
    function getCooldownInfo() public view returns (uint256 remainingTime, bool isActive) {
        if (!s_isSuccessful) {
            return (0, false);
        }
        if (block.timestamp < s_deadline) {
            return (0, false);
        }
        if (block.timestamp >= s_deadline + COOLDOWN_PERIOD) {
            return (0, false);
        }
        return (s_deadline + COOLDOWN_PERIOD - block.timestamp, true);
    }

    // 获取众筹剩余时间（秒）
    function getRemainingTime() public view returns (uint256) {
        if (block.timestamp >= s_deadline) return 0;
        return s_deadline - block.timestamp;
    }

    // 获取用户待领取代币数量
    function getPendingTokens(address user) public view returns (uint256) {
        return s_pendingTokens[user];
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

    function getCooldownPeriod() public pure returns (uint256) {
        return COOLDOWN_PERIOD;
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
        revert("Direct ETH transfer not allowed. Please call invest() instead.");
    }
}