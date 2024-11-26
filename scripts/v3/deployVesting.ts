import * as fs from "fs";
import { ethers } from "hardhat";
 

export async function deployVesting() {
 const registrationKey = "";
 const host="0x85Fe79b998509B77BF10A8BD4001D58475D29386"
 let vestingAddress="" 

  const [deployer, addr1, addr2] = await ethers.getSigners();
 
  const vestingScheduler = await ethers.getContractFactory("VestingScheduler");
  const deployV=await vestingScheduler.deploy(host,registrationKey);
  const vAddress= (await deployV).address;

  console.log(vAddress);
  vestingAddress=vAddress;
  fs.writeFileSync(
    `./vestingAddress`,
    vestingAddress
  );


}

deployVesting();