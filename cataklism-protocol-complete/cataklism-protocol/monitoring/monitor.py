#!/usr/bin/env python3
"""
Cataklism Protocol Monitoring System
Real-time monitoring and alerting for protocol health and performance
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import aiohttp
import asyncpg
from web3 import Web3
from web3.middleware import geth_poa_middleware
import redis
from dataclasses import dataclass, asdict
from enum import Enum
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import discord
from telegram import Bot
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from prometheus_client import start_http_server, Gauge, Counter, Histogram

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

@dataclass
class Alert:
    level: AlertLevel
    title: str
    message: str
    timestamp: datetime
    metric: str
    value: float
    threshold: float
    source: str

@dataclass
class ProtocolMetrics:
    timestamp: datetime
    total_value_locked: float
    total_stakers: int
    active_pools: int
    average_apy: float
    token_price: float
    market_cap: float
    vault_tvl: float
    vault_apy: float
    gas_price: float
    block_number: int
    network_health: bool

class CataklismMonitor:
    """Main monitoring class for Cataklism Protocol"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.web3_clients = {}
        self.redis_client = None
        self.db_pool = None
        self.alerts = []

        # Prometheus metrics
        self.tvl_gauge = Gauge('cataklism_tvl_total', 'Total Value Locked in USD')
        self.stakers_gauge = Gauge('cataklism_stakers_total', 'Total number of stakers')
        self.apy_gauge = Gauge('cataklism_apy_average', 'Average APY across pools')
        self.token_price_gauge = Gauge('cataklism_token_price_usd', 'CTKL token price in USD')
        self.gas_price_gauge = Gauge('cataklism_gas_price_gwei', 'Current gas price in gwei')
        self.alerts_counter = Counter('cataklism_alerts_total', 'Total alerts triggered', ['level'])
        self.response_time_histogram = Histogram('cataklism_api_response_seconds', 'API response time')

        # Alert thresholds
        self.thresholds = {
            'tvl_drop_percentage': 20,  # Alert if TVL drops by 20%
            'gas_price_gwei': 100,      # Alert if gas > 100 gwei
            'apy_drop_percentage': 50,   # Alert if APY drops by 50%
            'token_price_drop_percentage': 30,  # Alert if price drops by 30%
            'vault_utilization': 95,    # Alert if vault is 95% utilized
            'response_time_seconds': 5,  # Alert if API response > 5s
            'failed_transactions_percentage': 10  # Alert if >10% tx fail
        }

    async def initialize(self):
        """Initialize all monitoring components"""
        logger.info("Initializing Cataklism Protocol Monitor...")

        try:
            # Initialize Web3 clients
            await self._initialize_web3_clients()

            # Initialize Redis
            self.redis_client = redis.Redis(
                host=self.config['redis']['host'],
                port=self.config['redis']['port'],
                db=self.config['redis']['db'],
                decode_responses=True
            )

            # Initialize database
            self.db_pool = await asyncpg.create_pool(
                self.config['database']['url'],
                min_size=5,
                max_size=20
            )

            # Start Prometheus metrics server
            start_http_server(self.config['prometheus']['port'])

            logger.info("Monitor initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize monitor: {e}")
            raise

    async def _initialize_web3_clients(self):
        """Initialize Web3 clients for each network"""
        for network, config in self.config['networks'].items():
            try:
                w3 = Web3(Web3.HTTPProvider(config['rpc_url']))

                # Add PoA middleware for some networks
                if config.get('poa', False):
                    w3.middleware_onion.inject(geth_poa_middleware, layer=0)

                # Verify connection
                if w3.isConnected():
                    self.web3_clients[network] = w3
                    logger.info(f"Connected to {network} network")
                else:
                    logger.warning(f"Failed to connect to {network} network")

            except Exception as e:
                logger.error(f"Error connecting to {network}: {e}")

    async def start_monitoring(self):
        """Start the main monitoring loop"""
        logger.info("Starting monitoring loop...")

        tasks = [
            self._monitor_protocol_metrics(),
            self._monitor_network_health(),
            self._monitor_gas_prices(),
            self._monitor_api_health(),
            self._monitor_smart_contracts(),
            self._process_alerts(),
            self._generate_reports(),
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _monitor_protocol_metrics(self):
        """Monitor core protocol metrics"""
        while True:
            try:
                logger.info("Collecting protocol metrics...")

                # Get metrics from API
                metrics = await self._fetch_protocol_metrics()

                # Update Prometheus metrics
                self.tvl_gauge.set(metrics.total_value_locked)
                self.stakers_gauge.set(metrics.total_stakers)
                self.apy_gauge.set(metrics.average_apy)
                self.token_price_gauge.set(metrics.token_price)
                self.gas_price_gauge.set(metrics.gas_price)

                # Store in database
                await self._store_metrics(metrics)

                # Check for alerts
                await self._check_metric_alerts(metrics)

                # Cache metrics
                await self._cache_metrics(metrics)

                logger.info(f"Protocol metrics updated - TVL: ${metrics.total_value_locked:,.2f}")

            except Exception as e:
                logger.error(f"Error monitoring protocol metrics: {e}")
                await self._create_alert(
                    AlertLevel.WARNING,
                    "Metrics Collection Failed",
                    f"Failed to collect protocol metrics: {e}",
                    "metrics_collection",
                    0,
                    1
                )

            await asyncio.sleep(60)  # Check every minute

    async def _fetch_protocol_metrics(self) -> ProtocolMetrics:
        """Fetch metrics from protocol API"""
        async with aiohttp.ClientSession() as session:
            with self.response_time_histogram.time():
                async with session.get(f"{self.config['api']['base_url']}/protocol/stats") as response:
                    if response.status != 200:
                        raise Exception(f"API returned status {response.status}")

                    data = await response.json()

                    return ProtocolMetrics(
                        timestamp=datetime.now(),
                        total_value_locked=float(data['tvl']),
                        total_stakers=int(data['total_stakers']),
                        active_pools=int(data['active_pools']),
                        average_apy=float(data['avg_apy']),
                        token_price=float(data['token_price']),
                        market_cap=float(data['market_cap']),
                        vault_tvl=float(data['vault_tvl']),
                        vault_apy=float(data['vault_apy']),
                        gas_price=float(data['gas_price']),
                        block_number=int(data['block_number']),
                        network_health=bool(data['network_health'])
                    )

    async def _monitor_network_health(self):
        """Monitor blockchain network health"""
        while True:
            try:
                for network, w3 in self.web3_clients.items():
                    logger.info(f"Checking {network} network health...")

                    # Check if connected
                    if not w3.isConnected():
                        await self._create_alert(
                            AlertLevel.CRITICAL,
                            f"{network} Network Disconnected",
                            f"Lost connection to {network} network",
                            f"network_{network}",
                            0,
                            1
                        )
                        continue

                    # Check latest block
                    try:
                        latest_block = w3.eth.get_block('latest')
                        block_age = datetime.now().timestamp() - latest_block.timestamp

                        if block_age > 300:  # 5 minutes
                            await self._create_alert(
                                AlertLevel.WARNING,
                                f"{network} Stale Blocks",
                                f"Latest block is {block_age/60:.1f} minutes old",
                                f"block_age_{network}",
                                block_age,
                                300
                            )

                    except Exception as e:
                        logger.error(f"Error checking {network} blocks: {e}")

            except Exception as e:
                logger.error(f"Error monitoring network health: {e}")

            await asyncio.sleep(300)  # Check every 5 minutes

    async def _monitor_gas_prices(self):
        """Monitor gas prices across networks"""
        while True:
            try:
                for network, w3 in self.web3_clients.items():
                    try:
                        gas_price = w3.eth.gas_price
                        gas_price_gwei = w3.fromWei(gas_price, 'gwei')

                        # Update metrics
                        self.gas_price_gauge.set(gas_price_gwei)

                        # Check threshold
                        if gas_price_gwei > self.thresholds['gas_price_gwei']:
                            await self._create_alert(
                                AlertLevel.WARNING,
                                f"High Gas Prices on {network}",
                                f"Gas price is {gas_price_gwei:.1f} gwei",
                                f"gas_price_{network}",
                                gas_price_gwei,
                                self.thresholds['gas_price_gwei']
                            )

                        logger.info(f"{network} gas price: {gas_price_gwei:.1f} gwei")

                    except Exception as e:
                        logger.error(f"Error checking gas price for {network}: {e}")

            except Exception as e:
                logger.error(f"Error monitoring gas prices: {e}")

            await asyncio.sleep(180)  # Check every 3 minutes

    async def _monitor_api_health(self):
        """Monitor API endpoint health"""
        endpoints = [
            '/health',
            '/api/protocol/stats',
            '/api/vault/stats',
            '/api/staking/pools',
        ]

        while True:
            try:
                for endpoint in endpoints:
                    url = f"{self.config['api']['base_url']}{endpoint}"

                    start_time = time.time()
                    async with aiohttp.ClientSession() as session:
                        try:
                            async with session.get(url, timeout=10) as response:
                                response_time = time.time() - start_time

                                if response.status != 200:
                                    await self._create_alert(
                                        AlertLevel.WARNING,
                                        f"API Endpoint Error",
                                        f"{endpoint} returned status {response.status}",
                                        f"api_{endpoint.replace('/', '_')}",
                                        response.status,
                                        200
                                    )

                                elif response_time > self.thresholds['response_time_seconds']:
                                    await self._create_alert(
                                        AlertLevel.WARNING,
                                        f"Slow API Response",
                                        f"{endpoint} took {response_time:.2f}s to respond",
                                        f"response_time_{endpoint.replace('/', '_')}",
                                        response_time,
                                        self.thresholds['response_time_seconds']
                                    )

                        except asyncio.TimeoutError:
                            await self._create_alert(
                                AlertLevel.CRITICAL,
                                f"API Timeout",
                                f"{endpoint} timed out after 10 seconds",
                                f"timeout_{endpoint.replace('/', '_')}",
                                10,
                                5
                            )

                        except Exception as e:
                            await self._create_alert(
                                AlertLevel.CRITICAL,
                                f"API Connection Error",
                                f"Failed to connect to {endpoint}: {e}",
                                f"connection_{endpoint.replace('/', '_')}",
                                0,
                                1
                            )

            except Exception as e:
                logger.error(f"Error monitoring API health: {e}")

            await asyncio.sleep(120)  # Check every 2 minutes

    async def _monitor_smart_contracts(self):
        """Monitor smart contract state and events"""
        while True:
            try:
                for network, w3 in self.web3_clients.items():
                    contract_addresses = self.config['contracts'][network]

                    for contract_name, address in contract_addresses.items():
                        try:
                            # Check contract bytecode exists
                            code = w3.eth.get_code(address)
                            if code == b'':
                                await self._create_alert(
                                    AlertLevel.EMERGENCY,
                                    f"Contract Code Missing",
                                    f"{contract_name} contract has no bytecode at {address}",
                                    f"contract_{contract_name}_{network}",
                                    0,
                                    1
                                )
                                continue

                            # Contract-specific checks would go here
                            # For example, checking pause states, owner addresses, etc.

                        except Exception as e:
                            logger.error(f"Error checking {contract_name} on {network}: {e}")

            except Exception as e:
                logger.error(f"Error monitoring smart contracts: {e}")

            await asyncio.sleep(600)  # Check every 10 minutes

    async def _check_metric_alerts(self, metrics: ProtocolMetrics):
        """Check if metrics trigger any alerts"""
        # Get previous metrics for comparison
        previous = await self._get_cached_metrics()
        if not previous:
            return

        # TVL drop check
        if previous.total_value_locked > 0:
            tvl_change = ((metrics.total_value_locked - previous.total_value_locked) /
                         previous.total_value_locked) * 100

            if tvl_change < -self.thresholds['tvl_drop_percentage']:
                await self._create_alert(
                    AlertLevel.CRITICAL,
                    "Significant TVL Drop",
                    f"TVL dropped by {abs(tvl_change):.1f}% to ${metrics.total_value_locked:,.2f}",
                    "tvl_drop",
                    abs(tvl_change),
                    self.thresholds['tvl_drop_percentage']
                )

        # APY drop check
        if previous.average_apy > 0:
            apy_change = ((metrics.average_apy - previous.average_apy) /
                         previous.average_apy) * 100

            if apy_change < -self.thresholds['apy_drop_percentage']:
                await self._create_alert(
                    AlertLevel.WARNING,
                    "Significant APY Drop",
                    f"Average APY dropped by {abs(apy_change):.1f}% to {metrics.average_apy:.2f}%",
                    "apy_drop",
                    abs(apy_change),
                    self.thresholds['apy_drop_percentage']
                )

        # Token price drop check
        if previous.token_price > 0:
            price_change = ((metrics.token_price - previous.token_price) /
                           previous.token_price) * 100

            if price_change < -self.thresholds['token_price_drop_percentage']:
                await self._create_alert(
                    AlertLevel.WARNING,
                    "Token Price Drop",
                    f"CTKL price dropped by {abs(price_change):.1f}% to ${metrics.token_price:.4f}",
                    "token_price_drop",
                    abs(price_change),
                    self.thresholds['token_price_drop_percentage']
                )

    async def _create_alert(self, level: AlertLevel, title: str, message: str,
                          metric: str, value: float, threshold: float):
        """Create and process a new alert"""
        alert = Alert(
            level=level,
            title=title,
            message=message,
            timestamp=datetime.now(),
            metric=metric,
            value=value,
            threshold=threshold,
            source="monitor"
        )

        self.alerts.append(alert)
        self.alerts_counter.labels(level=level.value).inc()

        logger.warning(f"ALERT [{level.value.upper()}]: {title} - {message}")

        # Store alert in database
        await self._store_alert(alert)

        # Send notifications based on level
        if level in [AlertLevel.CRITICAL, AlertLevel.EMERGENCY]:
            await self._send_notifications(alert)

    async def _process_alerts(self):
        """Process and manage alerts"""
        while True:
            try:
                # Clean up old alerts
                cutoff_time = datetime.now() - timedelta(hours=24)
                self.alerts = [alert for alert in self.alerts if alert.timestamp > cutoff_time]

                # Generate alert summary
                if len(self.alerts) > 0:
                    logger.info(f"Active alerts: {len(self.alerts)}")

                    # Group by level
                    by_level = {}
                    for alert in self.alerts:
                        by_level.setdefault(alert.level.value, 0)
                        by_level[alert.level.value] += 1

                    logger.info(f"Alert breakdown: {by_level}")

            except Exception as e:
                logger.error(f"Error processing alerts: {e}")

            await asyncio.sleep(3600)  # Process every hour

    async def _generate_reports(self):
        """Generate periodic reports"""
        while True:
            try:
                # Generate daily report at midnight
                now = datetime.now()
                if now.hour == 0 and now.minute == 0:
                    await self._generate_daily_report()

                # Generate weekly report on Sundays
                if now.weekday() == 6 and now.hour == 0 and now.minute == 0:
                    await self._generate_weekly_report()

            except Exception as e:
                logger.error(f"Error generating reports: {e}")

            await asyncio.sleep(60)  # Check every minute

    async def _store_metrics(self, metrics: ProtocolMetrics):
        """Store metrics in database"""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO protocol_metrics
                (timestamp, tvl, total_stakers, active_pools, avg_apy, token_price,
                 market_cap, vault_tvl, vault_apy, gas_price, block_number, network_health)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """, metrics.timestamp, metrics.total_value_locked, metrics.total_stakers,
                metrics.active_pools, metrics.average_apy, metrics.token_price,
                metrics.market_cap, metrics.vault_tvl, metrics.vault_apy,
                metrics.gas_price, metrics.block_number, metrics.network_health)

    async def _cache_metrics(self, metrics: ProtocolMetrics):
        """Cache latest metrics in Redis"""
        self.redis_client.setex(
            "latest_metrics",
            300,  # 5 minutes TTL
            json.dumps(asdict(metrics), default=str)
        )

    async def _get_cached_metrics(self) -> Optional[ProtocolMetrics]:
        """Get cached metrics from Redis"""
        cached = self.redis_client.get("latest_metrics")
        if cached:
            data = json.loads(cached)
            return ProtocolMetrics(**data)
        return None

    async def _store_alert(self, alert: Alert):
        """Store alert in database"""
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO alerts
                (level, title, message, timestamp, metric, value, threshold, source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """, alert.level.value, alert.title, alert.message, alert.timestamp,
                alert.metric, alert.value, alert.threshold, alert.source)

    async def _send_notifications(self, alert: Alert):
        """Send alert notifications"""
        try:
            # Email notification
            if self.config.get('email', {}).get('enabled', False):
                await self._send_email_alert(alert)

            # Discord notification
            if self.config.get('discord', {}).get('enabled', False):
                await self._send_discord_alert(alert)

            # Telegram notification
            if self.config.get('telegram', {}).get('enabled', False):
                await self._send_telegram_alert(alert)

        except Exception as e:
            logger.error(f"Error sending notifications: {e}")

    async def _send_email_alert(self, alert: Alert):
        """Send email alert"""
        config = self.config['email']

        msg = MimeMultipart()
        msg['From'] = config['from']
        msg['To'] = ', '.join(config['to'])
        msg['Subject'] = f"[Cataklism] {alert.level.value.upper()}: {alert.title}"

        body = f"""
        Alert Level: {alert.level.value.upper()}
        Title: {alert.title}
        Message: {alert.message}
        Metric: {alert.metric}
        Value: {alert.value}
        Threshold: {alert.threshold}
        Timestamp: {alert.timestamp}
        """

        msg.attach(MimeText(body, 'plain'))

        server = smtplib.SMTP(config['smtp_host'], config['smtp_port'])
        server.starttls()
        server.login(config['username'], config['password'])
        server.send_message(msg)
        server.quit()

    async def _generate_daily_report(self):
        """Generate daily monitoring report"""
        logger.info("Generating daily report...")

        # Get metrics from last 24 hours
        async with self.db_pool.acquire() as conn:
            metrics_data = await conn.fetch("""
                SELECT * FROM protocol_metrics
                WHERE timestamp >= NOW() - INTERVAL '24 hours'
                ORDER BY timestamp
            """)

        if not metrics_data:
            return

        # Convert to DataFrame for analysis
        df = pd.DataFrame([dict(row) for row in metrics_data])

        # Generate charts
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))

        # TVL chart
        axes[0, 0].plot(df['timestamp'], df['tvl'])
        axes[0, 0].set_title('Total Value Locked (24h)')
        axes[0, 0].set_ylabel('TVL ($)')

        # APY chart
        axes[0, 1].plot(df['timestamp'], df['avg_apy'])
        axes[0, 1].set_title('Average APY (24h)')
        axes[0, 1].set_ylabel('APY (%)')

        # Token price chart
        axes[1, 0].plot(df['timestamp'], df['token_price'])
        axes[1, 0].set_title('Token Price (24h)')
        axes[1, 0].set_ylabel('Price ($)')

        # Gas price chart
        axes[1, 1].plot(df['timestamp'], df['gas_price'])
        axes[1, 1].set_title('Gas Price (24h)')
        axes[1, 1].set_ylabel('Gas Price (gwei)')

        plt.tight_layout()
        plt.savefig(f'reports/daily_report_{datetime.now().strftime("%Y%m%d")}.png')
        plt.close()

        logger.info("Daily report generated")

async def main():
    """Main entry point"""
    # Load configuration
    with open('config.json', 'r') as f:
        config = json.load(f)

    # Initialize monitor
    monitor = CataklismMonitor(config)
    await monitor.initialize()

    # Start monitoring
    try:
        await monitor.start_monitoring()
    except KeyboardInterrupt:
        logger.info("Monitoring stopped by user")
    except Exception as e:
        logger.error(f"Monitoring failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
