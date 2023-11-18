/* 
import {Signer} from "ethers";
import { waffle} from "hardhat";
const { deployMockContract, provider } = waffle;

import {ABI} from "./erc20";
 
export async function deployMockUsdc(deployer: Signer) {
  const erc20 = await waffle.deployMockContract(
    deployer,
    ABI.usdc
  );

  await erc20.mock.decimals.returns(6);
  await erc20.mock.name.returns(`USD Coin`);
  await erc20.mock.symbol.returns(`USDC`);
  await erc20.mock.transferFrom.returns(true);

  return erc20;
}
 */