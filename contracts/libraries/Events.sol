// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import {DataTypes} from "./DataTypes.sol";

library Events {
    event producerCreateOrUpdatedEvent(
        address producerAddress,
        string name,
        string description,
        string image,
        string externalLink
    );
}
