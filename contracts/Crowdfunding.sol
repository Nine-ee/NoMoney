// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./ProjectToken.sol";

contract Crowdfunding {
    address public immutable i_owner;
    uint256 public immutable s_goal;
    uint256 public immutable s_deadline;
    uint256 public s_raisedAmount;
    bool public s_isSuccessful;
    bool public s_isWithdrawn;
    
    mapping(address => uint256) public s_investors;
    address[] public s_investorAddresses;
    uint256 public s_investorCount;
    
    ProjectToken public s_token;
    
    uint256 public s_earlyBirdLimit;
    uint256 public s_earlyBirdBonusRate;
    mapping(address => bool) public s_isEarlyBird;
    
    uint256 public s_refundDeadline;
    bool public s_refundWindowOpen;

    event Invested(address indexed investor, uint256 amount, bool isEarlyBird);
    event Refunded(address indexed investor, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event TokensMinted(address indexed investor, uint256 amount, uint256 bonus);
    event CampaignFinalized(bool success);
    event EarlyBirdSet(uint256 limit, uint256 bonusRate);
    event RefundWindowSet(uint256 deadline);

    modifier onlyOwner() {
        require(msg.sender == i_owner, "Only project owner can call");
        _;
    }

    modifier campaignOngoing() {
        require(block.timestamp < s_deadline, "Campaign is ongoing");
        _;
    }

    modifier campaignEnded() {
        require(block.timestamp >= s_deadline, "Campaign has ended");
        _;
    }

    modifier successful() {
        require(s_isSuccessful, "Campaign is not successful");
        _;
    }

    modifier failed() {
        require(!s_isSuccessful, "Campaign is successful, cannot refund");
        _;
    }

    constructor(
        uint256 goal, 
        uint256 durationInSeconds, 
        address tokenAddress,
        uint256 earlyBirdLimit,
        uint256 earlyBirdBonusRate
    ) {
        i_owner = msg.sender;
        s_goal = goal;
        s_deadline = block.timestamp + durationInSeconds;
        s_token = ProjectToken(tokenAddress);
        s_earlyBirdLimit = earlyBirdLimit;
        s_earlyBirdBonusRate = earlyBirdBonusRate;
        s_isSuccessful = false;
        s_isWithdrawn = false;
        s_refundWindowOpen = false;
    }

    function invest() public payable campaignOngoing {
        require(msg.value > 0, "Investment must be greater than 0");

        if (s_investors[msg.sender] == 0) {
            s_investorAddresses.push(msg.sender);
            s_investorCount++;
            
            if (s_investorCount <= s_earlyBirdLimit) {
                s_isEarlyBird[msg.sender] = true;
            }
        }
        
        s_investors[msg.sender] += msg.value;
        s_raisedAmount += msg.value;
        
        emit Invested(msg.sender, msg.value, s_isEarlyBird[msg.sender]);
    }

    function finalizeCampaign() public campaignEnded {
        require(!s_isSuccessful, "Campaign already finalized");
        
        if (s_raisedAmount >= s_goal) {
            s_isSuccessful = true;
            
            for (uint256 i = 0; i < s_investorAddresses.length; i++) {
                address investor = s_investorAddresses[i];
                uint256 amountInvested = s_investors[investor];
                
                uint256 tokenAmount = (amountInvested * 10000) / 1e18;
                
                uint256 bonus = 0;
                if (s_isEarlyBird[investor]) {
                    bonus = (tokenAmount * s_earlyBirdBonusRate) / 10000;
                    tokenAmount += bonus;
                }
                
                if (tokenAmount > 0) {
                    s_token.mint(investor, tokenAmount);
                    emit TokensMinted(investor, tokenAmount, bonus);
                }
            }
        } else {
            s_isSuccessful = false;
        }
        
        emit CampaignFinalized(s_isSuccessful);
    }

    function withdrawFunds() public onlyOwner campaignEnded successful {
        require(!s_isWithdrawn, "Funds already withdrawn");
        require(address(this).balance > 0, "No funds to withdraw");
        
        s_isWithdrawn = true;
        (bool success, ) = i_owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(i_owner, address(this).balance);
    }

    function refund() public campaignEnded failed {
        require(s_refundWindowOpen, "Refund window is not open");
        require(block.timestamp < s_refundDeadline, "Refund window is closed");
        
        uint256 amountInvested = s_investors[msg.sender];
        require(amountInvested > 0, "No investment to refund");
        
        s_investors[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amountInvested}("");
        require(success, "Refund failed");
        
        emit Refunded(msg.sender, amountInvested);
    }

    function setRefundWindow(uint256 durationInSeconds) public onlyOwner campaignEnded {
        s_refundDeadline = block.timestamp + durationInSeconds;
        s_refundWindowOpen = true;
        emit RefundWindowSet(s_refundDeadline);
    }
    
    function closeRefundWindow() public onlyOwner {
        s_refundWindowOpen = false;
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
    
    function getRefundDeadline() public view returns (uint256) {
        return s_refundDeadline;
    }
    
    function isRefundWindowOpen() public view returns (bool) {
        return s_refundWindowOpen;
    }
}