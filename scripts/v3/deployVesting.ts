import * as fs from "fs";
import { ethers } from "hardhat";
 

export async function deployVesting() {
 const registrationKey = "";
 const host="0x109412E3C84f0539b43d39dB691B08c90f58dC7c"
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