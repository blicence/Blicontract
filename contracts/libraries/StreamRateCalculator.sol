// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {FactoryErrors} from "../errors/FactoryErrors.sol";

/**
 * @title StreamRateCalculator
 * @dev Library for calculating stream rates and time-based amounts
 */
library StreamRateCalculator {
    uint256 constant PRECISION = 1e18;
    uint256 constant MIN_STREAM_AMOUNT = 1000; // Minimum 1000 wei
    uint256 constant MIN_DURATION = 1 hours;   // Minimum 1 hour
    uint256 constant MAX_DURATION = 365 days;  // Maximum 1 year

    error InvalidDuration();
    error StreamRateTooLow();

    /**
     * @dev Calculate stream rate (amount per second)
     * @param totalAmount Total amount to be streamed
     * @param duration Duration in seconds
     * @return streamRate Amount per second in wei
     */
    function calculateStreamRate(
        uint256 totalAmount,
        uint256 duration
    ) internal pure returns (uint256 streamRate) {
        if (duration == 0) revert InvalidDuration();
        if (totalAmount < MIN_STREAM_AMOUNT) revert FactoryErrors.InvalidAmount();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        
        // Use precision for more accurate calculation
        uint256 rate = (totalAmount * PRECISION) / duration;
        streamRate = rate / PRECISION;
        
        if (streamRate == 0) revert StreamRateTooLow();
    }

    /**
     * @dev Calculate amount accrued for given time elapsed
     * @param streamRate Stream rate per second
     * @param timeElapsed Time elapsed in seconds
     * @return accruedAmount Amount accrued
     */
    function calculateAmountForTime(
        uint256 streamRate,
        uint256 timeElapsed
    ) internal pure returns (uint256 accruedAmount) {
        return streamRate * timeElapsed;
    }

    /**
     * @dev Calculate maximum duration for given amount and minimum rate
     * @param totalAmount Total amount
     * @param minStreamRate Minimum stream rate
     * @return maxDuration Maximum possible duration
     */
    function getMaxDuration(
        uint256 totalAmount,
        uint256 minStreamRate
    ) internal pure returns (uint256 maxDuration) {
        if (minStreamRate == 0) revert StreamRateTooLow();
        return totalAmount / minStreamRate;
    }

    /**
     * @dev Calculate remaining time for a stream
     * @param endTime Stream end timestamp
     * @param currentTime Current timestamp
     * @return remainingTime Remaining seconds
     */
    function calculateRemainingTime(
        uint256 endTime,
        uint256 currentTime
    ) internal pure returns (uint256 remainingTime) {
        if (currentTime >= endTime) {
            return 0;
        }
        return endTime - currentTime;
    }

    /**
     * @dev Validate stream parameters
     * @param totalAmount Total amount to stream
     * @param duration Duration in seconds
     * @param recipient Recipient address
     * @param token Token address
     */
    function validateStreamParams(
        uint256 totalAmount,
        uint256 duration,
        address recipient,
        address token
    ) internal pure {
        if (totalAmount < MIN_STREAM_AMOUNT) revert FactoryErrors.InvalidAmount();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        if (recipient == address(0)) revert InvalidRecipient();
        if (token == address(0)) revert FactoryErrors.InvalidToken();
    }

    /**
     * @dev Calculate stream progress as percentage (0-100)
     * @param startTime Stream start time
     * @param endTime Stream end time
     * @param currentTime Current time
     * @return progress Progress percentage (0-100)
     */
    function calculateProgress(
        uint256 startTime,
        uint256 endTime,
        uint256 currentTime
    ) internal pure returns (uint256 progress) {
        if (currentTime <= startTime) return 0;
        if (currentTime >= endTime) return 100;
        
        uint256 totalDuration = endTime - startTime;
        uint256 elapsed = currentTime - startTime;
        
        return (elapsed * 100) / totalDuration;
    }

    // Custom errors
    error InvalidRecipient();
    error InvalidToken();
}
