import { ethers } from "ethers";
import contractAddress from "../contract-address.json";
import Crowdfunding from "../artifacts/contracts/Crowdfunding.sol/Crowdfunding.json";
import ProjectToken from "../artifacts/contracts/ProjectToken.sol/ProjectToken.json";

const { crowdfundingAddress, tokenAddress } = contractAddress;

// ============ Hardhat 本地网络配置 ============
const LOCAL_NETWORK = {
  chainId: 31337,
  chainIdHex: '0x7A69',
  name: 'Hardhat Local',
  rpcUrl: 'http://localhost:8545',
};

// ============ 网络检查：自动切换 MetaMask 到本地 Hardhat 网络 ============
export const checkNetwork = async () => {
  if (!window.ethereum) {
    alert("请安装 MetaMask 钱包！");
    console.error("[网络] MetaMask 未安装");
    throw new Error("MetaMask未安装");
  }
  
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const network = await provider.getNetwork();
  
  console.log(`[网络] 当前链 ID: ${network.chainId}`);
  
  if (network.chainId !== LOCAL_NETWORK.chainId) {
    console.log(`[网络] 需要切换到 Hardhat 本地网络 (Chain ID: ${LOCAL_NETWORK.chainId})`);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: LOCAL_NETWORK.chainIdHex }],
      });
      console.log("[网络] 已切换到 Hardhat 本地网络");
    } catch (error) {
      if (error.code === 4902) {
        // 网络不存在，需要添加
        console.log("[网络] 正在添加 Hardhat 本地网络...");
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: LOCAL_NETWORK.chainIdHex,
            chainName: LOCAL_NETWORK.name,
            rpcUrls: [LOCAL_NETWORK.rpcUrl],
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
          }],
        });
        console.log("[网络] Hardhat 本地网络已添加");
      } else {
        console.error("[网络] 切换网络失败:", error);
        throw new Error("请手动将 MetaMask 连接到本地 Hardhat 网络（RPC: http://localhost:8545, Chain ID: 31337）");
      }
    }
  }
};

// ============ 获取 Provider（只读） ============
export const getProvider = () => {
  if (!window.ethereum) {
    alert("请安装 MetaMask 钱包！");
    throw new Error("MetaMask未安装");
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

// ============ 获取 Signer（需要签名交易时使用） ============
export const getSigner = async () => {
  const provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
};

// ============ 获取众筹合约实例（可写） ============
export const getCrowdfundingContract = async () => {
  const signer = await getSigner();
  return new ethers.Contract(crowdfundingAddress, Crowdfunding.abi, signer);
};

// ============ 获取代币合约实例（可写） ============
export const getTokenContract = async () => {
  const signer = await getSigner();
  return new ethers.Contract(tokenAddress, ProjectToken.abi, signer);
};

// ============ 获取众筹合约实例（只读） ============
export const getCrowdfundingContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(crowdfundingAddress, Crowdfunding.abi, provider);
};

// ============ 获取代币合约实例（只读） ============
export const getTokenContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(tokenAddress, ProjectToken.abi, provider);
};