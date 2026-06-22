import { ethers } from "ethers";
import contractAddress from "../contract-address.json";
import Crowdfunding from "../artifacts/contracts/Crowdfunding.sol/Crowdfunding.json";
import ProjectToken from "../artifacts/contracts/ProjectToken.sol/ProjectToken.json";

const { crowdfundingAddress, tokenAddress } = contractAddress;

export const getProvider = () => {
  if (!window.ethereum) {
    alert("请安装MetaMask！");
    throw new Error("MetaMask未安装");
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

export const getSigner = async () => {
  const provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
};

export const getCrowdfundingContract = async () => {
  const signer = await getSigner();
  return new ethers.Contract(crowdfundingAddress, Crowdfunding.abi, signer);
};

export const getTokenContract = async () => {
  const signer = await getSigner();
  return new ethers.Contract(tokenAddress, ProjectToken.abi, signer);
};

export const getCrowdfundingContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(crowdfundingAddress, Crowdfunding.abi, provider);
};

export const getTokenContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(tokenAddress, ProjectToken.abi, provider);
};