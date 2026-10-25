import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

/**
 * Builds a Merkle Tree from an array of coordinate records
 * @param {Array} records - Database telemetry objects
 * @returns {Object} { merkleRoot, tree, leafHashes }
 */
export const buildTelemetryMerkleTree = (records) => {
    if (!records || records.length === 0) {
        throw new Error("Cannot build Merkle Tree with empty records.");
    }

    const leafHashes = records.map((record) => {
        // Ethers v6: equivalent to Solidity's abi.encodePacked
        const packed = ethers.solidityPacked(
            ['string', 'int256', 'int256', 'int256', 'uint256'],
            [
                record.sat_id,
                Math.round(record.pos_x * 1000),
                Math.round(record.pos_y * 1000),
                Math.round(record.pos_z * 1000),
                record.epoch_timestamp
            ]
        );
        return keccak256(packed);
    });

    const tree = new MerkleTree(leafHashes, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();

    return { merkleRoot, tree, leafHashes };
};