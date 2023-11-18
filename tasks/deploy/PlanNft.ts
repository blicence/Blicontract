import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { PlanNft__factory } from "../../src/types";
import { PlanNft } from "../../src/types/contracts";


task("deploy:Bcontract").setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const bFactory: PlanNft__factory = <PlanNft__factory>(
        await ethers.getContractFactory("PlanNft")
    );
    const bcontract: PlanNft = <PlanNft>await bFactory.connect(signers[0]).deploy();
    await bcontract.deployed();
    console.log("bcontract deployed to: ", bcontract.address);
});
