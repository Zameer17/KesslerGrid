import { query } from '../config/db.js';
import { kesslerContract } from '../config/web3.js';
import { writeAuditLog } from '../utils/logger.js';

export const registerSatellite = async (req, res) => {
  try {
    const { satId, noradId, satelliteName, operatorAddress, stakedEth, liabilityPenaltyEth } = req.body;

    if (!satId || !noradId || !satelliteName || !operatorAddress) {
      return res.status(400).json({ error: 'Missing required satellite fields' });
    }

    const sql = `
      INSERT INTO satellites (sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, liability_penalty_eth, operational_status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE');
    `;
    const values = [satId, operatorAddress.toLowerCase(), noradId, satelliteName, stakedEth || 0.0, liabilityPenaltyEth || 5.0];
    await query(sql, values);

    writeAuditLog('INFO', 'REGISTRY', `Satellite ${satId} (NORAD: ${noradId}) registered by ${operatorAddress} with penalty ${liabilityPenaltyEth || 5.0} ETH`);

    return res.status(201).json({
      success: true,
      data: {
        sat_id: satId,
        operator_address: operatorAddress.toLowerCase(),
        norad_cat_id: noradId,
        satellite_name: satelliteName,
        staked_amount_eth: stakedEth || 0.0,
        liability_penalty_eth: liabilityPenaltyEth || 5.0,
        operational_status: 'ACTIVE',
      },
    });
  } catch (error) {
    if (error.code === '23505' || error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Satellite ID or NORAD ID already exists' });
    }
    console.error('Registration Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getAllSatellites = async (req, res) => {
  try {
    const result = await query('SELECT * FROM satellites ORDER BY registered_at DESC');
    const rows = result.rows && result.rows.length > 0 ? result.rows : [
      { sat_id: 'ISS-25544', norad_cat_id: 25544, satellite_name: 'ISS (ZARYA)', operator_address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', staked_amount_eth: 10.0, liability_penalty_eth: 5.0, operational_status: 'ACTIVE' },
      { sat_id: 'HST-20580', norad_cat_id: 20580, satellite_name: 'HUBBLE SPACE TELESCOPE', operator_address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', staked_amount_eth: 5.0, liability_penalty_eth: 5.0, operational_status: 'ACTIVE' },
      { sat_id: 'SENTINEL-60124', norad_cat_id: 60124, satellite_name: 'SENTINEL-X RECON', operator_address: '0x3c44cddddb6a900fa2b585dd299e03d12fa4293e', staked_amount_eth: 2.5, liability_penalty_eth: 5.0, operational_status: 'ACTIVE' }
    ];
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSatelliteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM satellites WHERE sat_id = ?', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Satellite not found' });
    }

    let onChainData = null;
    try {
      if (kesslerContract && kesslerContract.target) {
        const onChainSat = await kesslerContract.getSatellite(id);
        onChainData = {
          stakedAmountWei: onChainSat.stakedAmount.toString(),
          status: Number(onChainSat.status),
          registeredAt: Number(onChainSat.registeredAt),
        };
      }
    } catch (chainErr) {
      console.warn(`Could not fetch on-chain data for ${id}:`, chainErr.message);
    }

    return res.status(200).json({
      success: true,
      database: result.rows[0],
      onChain: onChainData,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};