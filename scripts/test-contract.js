const hre = require("hardhat");

async function main() {
  const [owner, addr1] = await hre.ethers.getSigners();
  
  console.log("测试账户:", owner.address);
  console.log("账户余额:", hre.ethers.utils.formatEther(await owner.getBalance()), "ETH");
  
  // 测试代币合约
  const token = await hre.ethers.getContractAt("ProjectToken", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");
  console.log("\n代币合约地址:", token.address);
  console.log("代币名称:", await token.name());
  console.log("代币符号:", await token.symbol());
  
  // 测试众筹合约
  const crowdfunding = await hre.ethers.getContractAt("Crowdfunding", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");
  console.log("\n众筹合约地址:", crowdfunding.address);
  console.log("众筹目标:", hre.ethers.utils.formatEther(await crowdfunding.s_goal()), "ETH");
  console.log("截止时间:", new Date(Number(await crowdfunding.s_deadline()) * 1000));
  
  // 测试投资
  console.log("\n测试投资...");
  const tx = await crowdfunding.connect(addr1).invest({ value: hre.ethers.utils.parseEther("0.1") });
  await tx.wait();
  console.log("投资成功！");
  
  const balance = await token.balanceOf(addr1.address);
  console.log("投资者代币余额:", hre.ethers.utils.formatEther(balance), "XXCT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});