import hre, { ethers } from "hardhat";
import { deployProxys } from "./v3/deployProxies";

async function main() {

 await deployProxys();
  // version 1
  
 /*  const signers = await ethers.getSigners();

  const Lib = await ethers.getContractFactory("Logic");
  const lib = await Lib.deploy();
  await lib.deployed();

  const contractFactory = await ethers.getContractFactory("Bcontract", {
    signer: signers[0],
    libraries: {
      Logic: lib.address,
    },
  });

  const contract = await contractFactory.deploy();
  //const contract = await ethers.deployContract("Bcontract");

  await contract.deployed();

  console.log("Bcontract deployed to:", contract.address); */

  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
 
