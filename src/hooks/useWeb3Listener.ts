import { useEffect } from 'react';
import { ethers } from 'ethers';
import { useSolarStore } from '../store/useSolarStore';

const RPC_URL = 'http://127.0.0.1:8545';

export function useWeb3Listener() {
  const addLiveBlock = useSolarStore((s) => s.addLiveBlock);

  useEffect(() => {
    let isMounted = true;
    let provider: ethers.JsonRpcProvider | null = null;
    let pollInterval: any = null;
    let lastProcessedBlock = -1;

    const processBlockNumber = async (blockNum: number, prov: ethers.JsonRpcProvider) => {
      if (!isMounted || blockNum < 0) return;
      try {
        const block = await prov.getBlock(blockNum);
        if (block && isMounted) {
          const gasUsedStr = block.gasUsed ? block.gasUsed.toString() : '0';
          const gasLimitStr = block.gasLimit ? block.gasLimit.toString() : '30000000';
          addLiveBlock({
            number: block.number,
            hash: block.hash || '',
            parentHash: block.parentHash || '',
            stateRoot: (block as any).stateRoot || (block as any).receiptsRoot || '',
            timestamp: block.timestamp,
            txCount: block.transactions ? block.transactions.length : 0,
            gasUsed: gasUsedStr,
            gasLimit: gasLimitStr,
            miner: block.miner || '',
          });
        }
      } catch (err) {
        // Soft catch if block fetch fails
      }
    };

    const initListener = async () => {
      try {
        provider = new ethers.JsonRpcProvider(RPC_URL);

        // Fetch current block and initial backfill of recent blocks
        const currentBlock = await provider.getBlockNumber();
        if (isMounted && currentBlock >= 0) {
          lastProcessedBlock = currentBlock;
          const startBlock = Math.max(0, currentBlock - 5);
          for (let n = currentBlock; n >= startBlock; n--) {
            await processBlockNumber(n, provider);
          }
        }

        // Attach event listener
        provider.on('block', async (newBlockNumber: number) => {
          if (!isMounted || !provider) return;
          if (newBlockNumber > lastProcessedBlock) {
            for (let n = lastProcessedBlock + 1; n <= newBlockNumber; n++) {
              await processBlockNumber(n, provider);
            }
            lastProcessedBlock = newBlockNumber;
          } else {
            await processBlockNumber(newBlockNumber, provider);
          }
        });

        // Polling safeguard every 3 seconds for local RPC environments
        pollInterval = setInterval(async () => {
          if (!isMounted || !provider) return;
          try {
            const latest = await provider.getBlockNumber();
            if (latest > lastProcessedBlock) {
              const start = lastProcessedBlock >= 0 ? lastProcessedBlock + 1 : latest;
              for (let n = start; n <= latest; n++) {
                await processBlockNumber(n, provider);
              }
              lastProcessedBlock = latest;
            }
          } catch (e) {}
        }, 3000);
      } catch (e) {
        // Retry connection after interval if RPC node is offline
        pollInterval = setInterval(() => {
          if (isMounted) initListener();
        }, 6000);
      }
    };

    initListener();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (provider) {
        try {
          provider.removeAllListeners();
          provider.destroy();
        } catch (e) {}
      }
    };
  }, [addLiveBlock]);
}
