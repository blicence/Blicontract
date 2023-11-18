import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { Bcontract } from "../../src/types/contracts/Bcontract";
import { Bcontract__factory } from "../../src/types/factories/contracts/Bcontract__factory";


task("deploy:Bcontract").setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const bFactory: Bcontract__factory = <Bcontract__factory>(
        await ethers.getContractFactory("Bcontract")
    );
    const bcontract: Bcontract = <Bcontract>await bFactory.connect(signers[0]).deploy();
    await bcontract.deployed();
    console.log("bcontract deployed to: ", bcontract.address);
});
