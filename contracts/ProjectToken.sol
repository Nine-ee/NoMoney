// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProjectToken is ERC20, Ownable {
    address public crowdfundingAddress;

    modifier onlyCrowdfunding() {
        require(
            msg.sender == crowdfundingAddress, 
            "Only crowdfunding can mint"
        );
        _;
    }

    constructor() ERC20("XXCT", "XXCT") {}

    function setCrowdfundingAddress(address _crowdfundingAddress) external onlyOwner {
        crowdfundingAddress = _crowdfundingAddress;
    }

    function mint(address to, uint256 amount) external onlyCrowdfunding {
        _mint(to, amount);
    }
}