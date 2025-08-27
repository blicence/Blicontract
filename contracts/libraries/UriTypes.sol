// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.30;

 //
library UriTypes {
   
  struct URIParams {
        address producerContractAddress;
        uint256 producerId;
        string producerName;
        uint256 planId;
        string planName;
        uint256 custumerPlanId;
        uint256 startTime;
        uint256 endTime;
        uint256 price;
        address priceAddress;
        string priceSymbol;
        bool isactive;
       
    }
}
