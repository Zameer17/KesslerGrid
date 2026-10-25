// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract KesslerGridCore {
    address public admin;
    address payable public penaltyTreasury;
    uint256 public constant MIN_STAKE_AMOUNT = 0.5 ether;

    struct Satellite {
        string satId;
        address owner;
        uint256 stakedAmount;
        bool isRegistered;
        bool hasActiveThreat;
    }

    mapping(string => Satellite) public satellites;

    event SatelliteRegistered(string indexed satId, address indexed owner, uint256 stakedAmount);
    event Staked(string indexed satId, address indexed owner, uint256 amount);
    event Withdrawn(string indexed satId, address indexed owner, uint256 amount);
    event Slashed(string indexed satId, uint256 slashedAmount, string reason);
    event CollateralSlashed(
        string indexed satId,
        address indexed owner,
        address indexed penaltyTreasury,
        uint256 amount,
        string reason
    );
    event PenaltyTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ThreatStatusUpdated(string indexed satId, bool hasActiveThreat);
    event AvoidanceBurnExecuted(string indexed satId, address indexed operator, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    constructor() {
        admin = msg.sender;
        // Default penalty / insurance reserve to dedicated address (Hardhat Account #9 / Reserve)
        penaltyTreasury = payable(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);
    }

    /// @notice Update the penalty / insurance reserve treasury address
    function setPenaltyTreasury(address payable _newTreasury) external onlyAdmin {
        require(_newTreasury != address(0), "Treasury cannot be zero address");
        address previousTreasury = penaltyTreasury;
        penaltyTreasury = _newTreasury;
        emit PenaltyTreasuryUpdated(previousTreasury, _newTreasury);
    }

    /// @notice Check if a satellite is registered on-chain
    function isRegistered(string memory satId) public view returns (bool) {
        return satellites[satId].isRegistered;
    }

    /// @notice Register a new satellite with initial ETH collateral (Minimum 0.5 ETH)
    function registerSatellite(string memory satId) public payable {
        require(bytes(satId).length > 0, "Empty satellite ID");
        require(!satellites[satId].isRegistered, "Satellite already registered");
        require(msg.value >= MIN_STAKE_AMOUNT, "Stake below minimum threshold");

        satellites[satId] = Satellite({
            satId: satId,
            owner: msg.sender,
            stakedAmount: msg.value,
            isRegistered: true,
            hasActiveThreat: false
        });

        emit SatelliteRegistered(satId, msg.sender, msg.value);
    }

    /// @notice Add additional ETH collateral to an existing registered satellite
    function stake(string memory satId) public payable {
        require(satellites[satId].isRegistered, "ERR_NOT_REGISTERED");
        require(msg.value > 0, "ERR_ZERO_STAKE");

        satellites[satId].stakedAmount += msg.value;

        emit Staked(satId, msg.sender, msg.value);
    }

    /// @notice Execute collision avoidance thruster burn to resolve active conjunction threat
    function executeAvoidanceBurn(string memory satId) public payable {
        require(bytes(satId).length > 0, "Empty satellite ID");
        satellites[satId].hasActiveThreat = false;
        emit AvoidanceBurnExecuted(satId, msg.sender, block.timestamp);
    }

    /// @notice Withdraw staked ETH collateral (Blocked during active collision threat)
    function withdraw(string memory satId, uint256 amount) public {
        require(satellites[satId].isRegistered, "ERR_NOT_REGISTERED");
        require(msg.sender == satellites[satId].owner, "Only satellite owner can withdraw");
        require(!satellites[satId].hasActiveThreat, "Cannot withdraw during active collision threat");
        require(amount > 0, "Withdraw amount must be greater than zero");
        require(amount <= satellites[satId].stakedAmount, "Insufficient staked amount");

        satellites[satId].stakedAmount -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdrawn(satId, msg.sender, amount);
    }

    /// @notice Set active collision threat status (Admin / AI Oracle Sentinel)
    function setThreatStatus(string memory satId, bool hasThreat) public onlyAdmin {
        require(satellites[satId].isRegistered, "ERR_NOT_REGISTERED");
        satellites[satId].hasActiveThreat = hasThreat;

        emit ThreatStatusUpdated(satId, hasThreat);
    }

    /// @notice Slash satellite collateral on critical un-evaded collision threat and transfer real ETH to penalty treasury
    function slash(string memory satId, string memory reason) public onlyAdmin {
        require(satellites[satId].isRegistered, "ERR_NOT_REGISTERED");
        uint256 amount = satellites[satId].stakedAmount;
        require(amount > 0, "No stake to slash");
        require(penaltyTreasury != address(0), "Treasury not configured");

        address originalOwner = satellites[satId].owner;

        // 1. Zero out internal accounting state BEFORE external call to prevent reentrancy
        satellites[satId].stakedAmount = 0;
        satellites[satId].hasActiveThreat = false;

        // 2. Perform actual native ETH transfer to penalty / insurance reserve
        (bool success, ) = penaltyTreasury.call{value: amount}("");
        require(success, "ETH transfer to penalty treasury failed");

        // 3. Emit legacy and rich collision slash events
        emit Slashed(satId, amount, reason);
        emit CollateralSlashed(satId, originalOwner, penaltyTreasury, amount, reason);
    }

    /// @notice Retrieve satellite metadata
    function getSatellite(string memory satId) public view returns (Satellite memory) {
        return satellites[satId];
    }
}