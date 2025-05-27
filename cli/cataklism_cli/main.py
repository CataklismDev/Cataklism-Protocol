#!/usr/bin/env python3
"""
Cataklism Protocol CLI Tool
Advanced command-line interface for interacting with Cataklism Protocol
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Optional
import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.text import Text

from .core.config import Config, load_config
from .core.web3_client import Web3Client
from .core.protocol_client import ProtocolClient
from .commands.wallet import WalletCommands
from .commands.staking import StakingCommands
from .commands.vault import VaultCommands
from .commands.governance import GovernanceCommands
from .commands.analytics import AnalyticsCommands
from .utils.formatters import format_token_amount, format_percentage, format_usd
from .utils.validators import validate_address, validate_amount
from .utils.logger import setup_logger

console = Console()
logger = logging.getLogger(__name__)

class CataklismCLI:
    """Main CLI application class"""

    def __init__(self, config_path: Optional[str] = None):
        self.config = load_config(config_path)
        self.web3_client = Web3Client(self.config)
        self.protocol_client = ProtocolClient(self.web3_client, self.config)

        # Initialize command modules
        self.wallet = WalletCommands(self.protocol_client)
        self.staking = StakingCommands(self.protocol_client)
        self.vault = VaultCommands(self.protocol_client)
        self.governance = GovernanceCommands(self.protocol_client)
        self.analytics = AnalyticsCommands(self.protocol_client)

    async def initialize(self):
        """Initialize the CLI application"""
        try:
            await self.web3_client.connect()
            await self.protocol_client.initialize()
            console.print("✅ [green]Connected to Cataklism Protocol[/green]")
        except Exception as e:
            console.print(f"❌ [red]Failed to initialize: {e}[/red]")
            raise

@click.group()
@click.option('--config', '-c', default=None, help='Path to configuration file')
@click.option('--network', '-n', default='ethereum', help='Network to connect to')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose logging')
@click.pass_context
def cli(ctx, config, network, verbose):
    """Cataklism Protocol CLI - Advanced DeFi Protocol Management Tool"""

    # Setup logging
    log_level = logging.DEBUG if verbose else logging.INFO
    setup_logger(log_level)

    # Initialize CLI
    ctx.ensure_object(dict)
    ctx.obj['cli'] = CataklismCLI(config)
    ctx.obj['network'] = network
    ctx.obj['verbose'] = verbose

@cli.command()
@click.pass_context
def status(ctx):
    """Show protocol status and health information"""
    async def _status():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Fetching protocol status...", total=None)

            try:
                # Get protocol statistics
                stats = await cli_app.protocol_client.get_protocol_stats()
                vault_stats = await cli_app.protocol_client.get_vault_stats()
                token_info = await cli_app.protocol_client.get_token_info()

                progress.stop()

                # Create status table
                table = Table(title="Cataklism Protocol Status", show_header=True)
                table.add_column("Metric", style="cyan", no_wrap=True)
                table.add_column("Value", style="magenta")
                table.add_column("Description", style="white")

                # Protocol metrics
                table.add_row(
                    "Total Value Locked",
                    format_usd(stats['tvl']),
                    "Total assets locked in protocol"
                )
                table.add_row(
                    "Total Stakers",
                    f"{stats['total_stakers']:,}",
                    "Number of unique stakers"
                )
                table.add_row(
                    "Active Pools",
                    str(stats['active_pools']),
                    "Number of active staking pools"
                )
                table.add_row(
                    "Protocol APY",
                    format_percentage(stats['avg_apy']),
                    "Average annual percentage yield"
                )

                # Token metrics
                table.add_row(
                    "Token Price",
                    format_usd(token_info['price']),
                    "Current CTKL token price"
                )
                table.add_row(
                    "Market Cap",
                    format_usd(token_info['market_cap']),
                    "Total market capitalization"
                )
                table.add_row(
                    "Circulating Supply",
                    format_token_amount(token_info['circulating_supply']),
                    "CTKL tokens in circulation"
                )

                # Vault metrics
                table.add_row(
                    "Vault TVL",
                    format_usd(vault_stats['total_assets']),
                    "Total assets in vault strategies"
                )
                table.add_row(
                    "Vault APY",
                    format_percentage(vault_stats['apy']),
                    "Vault annual percentage yield"
                )

                console.print(table)

                # Network status
                network_panel = Panel(
                    f"🌐 Network: {cli_app.config.network.name}\n"
                    f"📡 RPC: {cli_app.config.network.rpc_url}\n"
                    f"⛽ Gas Price: {stats['gas_price']} gwei\n"
                    f"🔗 Block Number: {stats['block_number']:,}",
                    title="Network Information",
                    border_style="green"
                )
                console.print(network_panel)

            except Exception as e:
                progress.stop()
                console.print(f"❌ [red]Error fetching status: {e}[/red]")
                return 1

    return asyncio.run(_status())

@cli.group()
def wallet():
    """Wallet management commands"""
    pass

@wallet.command('balance')
@click.argument('address', required=False)
@click.option('--token', '-t', default='CTKL', help='Token symbol to check')
@click.pass_context
def wallet_balance(ctx, address, token):
    """Check wallet balance"""
    async def _balance():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        if not address:
            address = cli_app.config.wallet.address

        if not validate_address(address):
            console.print("❌ [red]Invalid address format[/red]")
            return 1

        try:
            balance = await cli_app.wallet.get_balance(address, token)
            price = await cli_app.protocol_client.get_token_price(token)

            console.print(Panel(
                f"💰 Address: {address}\n"
                f"🪙 {token} Balance: {format_token_amount(balance)}\n"
                f"💵 USD Value: {format_usd(float(balance) * price)}",
                title=f"{token} Balance",
                border_style="blue"
            ))

        except Exception as e:
            console.print(f"❌ [red]Error: {e}[/red]")
            return 1

    return asyncio.run(_balance())

@cli.group()
def stake():
    """Staking management commands"""
    pass

@stake.command('deposit')
@click.argument('pool_id', type=int)
@click.argument('amount', type=str)
@click.option('--gas-limit', type=int, help='Custom gas limit')
@click.option('--gas-price', type=str, help='Custom gas price in gwei')
@click.pass_context
def stake_deposit(ctx, pool_id, amount, gas_limit, gas_price):
    """Deposit tokens to staking pool"""
    async def _deposit():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        if not validate_amount(amount):
            console.print("❌ [red]Invalid amount format[/red]")
            return 1

        try:
            # Get pool info
            pool_info = await cli_app.staking.get_pool_info(pool_id)

            # Confirm transaction
            console.print(Panel(
                f"🏊 Pool: {pool_info['name']} (#{pool_id})\n"
                f"💰 Amount: {format_token_amount(amount)} {pool_info['token_symbol']}\n"
                f"📈 Current APY: {format_percentage(pool_info['apy'])}\n"
                f"💎 Reward Rate: {format_token_amount(pool_info['reward_rate'])} CTKL/day",
                title="Stake Deposit Confirmation",
                border_style="yellow"
            ))

            if not click.confirm("Do you want to proceed with this deposit?"):
                console.print("❌ Transaction cancelled")
                return 0

            # Execute deposit
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                task = progress.add_task("Executing deposit transaction...", total=None)

                tx_hash = await cli_app.staking.deposit(
                    pool_id,
                    amount,
                    gas_limit=gas_limit,
                    gas_price=gas_price
                )

                progress.stop()

                console.print(f"✅ [green]Deposit successful![/green]")
                console.print(f"📄 Transaction: {tx_hash}")
                console.print(f"🔗 Explorer: {cli_app.config.network.explorer}/tx/{tx_hash}")

        except Exception as e:
            console.print(f"❌ [red]Deposit failed: {e}[/red]")
            return 1

    return asyncio.run(_deposit())

@stake.command('withdraw')
@click.argument('pool_id', type=int)
@click.argument('amount', type=str)
@click.option('--gas-limit', type=int, help='Custom gas limit')
@click.option('--gas-price', type=str, help='Custom gas price in gwei')
@click.pass_context
def stake_withdraw(ctx, pool_id, amount, gas_limit, gas_price):
    """Withdraw tokens from staking pool"""
    async def _withdraw():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        if not validate_amount(amount):
            console.print("❌ [red]Invalid amount format[/red]")
            return 1

        try:
            # Get user stake info
            stake_info = await cli_app.staking.get_user_stake_info(
                pool_id,
                cli_app.config.wallet.address
            )

            if float(amount) > float(stake_info['staked_amount']):
                console.print("❌ [red]Insufficient staked balance[/red]")
                return 1

            # Show pending rewards
            pending_rewards = await cli_app.staking.get_pending_rewards(
                pool_id,
                cli_app.config.wallet.address
            )

            console.print(Panel(
                f"💰 Withdrawing: {format_token_amount(amount)}\n"
                f"🎁 Pending Rewards: {format_token_amount(pending_rewards)} CTKL\n"
                f"⚠️  Note: Rewards will be automatically claimed",
                title="Stake Withdrawal Confirmation",
                border_style="yellow"
            ))

            if not click.confirm("Do you want to proceed with this withdrawal?"):
                console.print("❌ Transaction cancelled")
                return 0

            # Execute withdrawal
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                task = progress.add_task("Executing withdrawal transaction...", total=None)

                tx_hash = await cli_app.staking.withdraw(
                    pool_id,
                    amount,
                    gas_limit=gas_limit,
                    gas_price=gas_price
                )

                progress.stop()

                console.print(f"✅ [green]Withdrawal successful![/green]")
                console.print(f"📄 Transaction: {tx_hash}")
                console.print(f"🔗 Explorer: {cli_app.config.network.explorer}/tx/{tx_hash}")

        except Exception as e:
            console.print(f"❌ [red]Withdrawal failed: {e}[/red]")
            return 1

    return asyncio.run(_withdraw())

@stake.command('pools')
@click.option('--active-only', is_flag=True, help='Show only active pools')
@click.pass_context
def stake_pools(ctx, active_only):
    """List all staking pools"""
    async def _pools():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        try:
            pools = await cli_app.staking.get_all_pools(active_only)

            if not pools:
                console.print("ℹ️  No pools found")
                return 0

            table = Table(title="Staking Pools", show_header=True)
            table.add_column("ID", justify="center", style="cyan")
            table.add_column("Token", style="magenta")
            table.add_column("TVL", justify="right", style="green")
            table.add_column("APY", justify="right", style="yellow")
            table.add_column("Reward Rate", justify="right", style="blue")
            table.add_column("Status", justify="center")

            for pool in pools:
                status_emoji = "🟢" if pool['is_active'] else "🔴"
                status_text = "Active" if pool['is_active'] else "Inactive"

                table.add_row(
                    str(pool['id']),
                    pool['token_symbol'],
                    format_usd(pool['tvl']),
                    format_percentage(pool['apy']),
                    f"{format_token_amount(pool['reward_rate'])}/day",
                    f"{status_emoji} {status_text}"
                )

            console.print(table)

        except Exception as e:
            console.print(f"❌ [red]Error fetching pools: {e}[/red]")
            return 1

    return asyncio.run(_pools())

@cli.group()
def vault():
    """Vault management commands"""
    pass

@vault.command('deposit')
@click.argument('amount', type=str)
@click.option('--gas-limit', type=int, help='Custom gas limit')
@click.option('--gas-price', type=str, help='Custom gas price in gwei')
@click.pass_context
def vault_deposit(ctx, amount, gas_limit, gas_price):
    """Deposit tokens to vault"""
    async def _deposit():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        if not validate_amount(amount):
            console.print("❌ [red]Invalid amount format[/red]")
            return 1

        try:
            vault_stats = await cli_app.vault.get_vault_stats()
            shares = await cli_app.vault.calculate_shares(amount)

            console.print(Panel(
                f"💰 Deposit Amount: {format_token_amount(amount)} CTKL\n"
                f"📜 Shares Received: {format_token_amount(shares)}\n"
                f"📈 Current APY: {format_percentage(vault_stats['apy'])}\n"
                f"💎 Share Value: {format_token_amount(vault_stats['share_value'])} CTKL",
                title="Vault Deposit Confirmation",
                border_style="yellow"
            ))

            if not click.confirm("Do you want to proceed with this deposit?"):
                console.print("❌ Transaction cancelled")
                return 0

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                task = progress.add_task("Executing vault deposit...", total=None)

                tx_hash = await cli_app.vault.deposit(
                    amount,
                    gas_limit=gas_limit,
                    gas_price=gas_price
                )

                progress.stop()

                console.print(f"✅ [green]Vault deposit successful![/green]")
                console.print(f"📄 Transaction: {tx_hash}")
                console.print(f"🔗 Explorer: {cli_app.config.network.explorer}/tx/{tx_hash}")

        except Exception as e:
            console.print(f"❌ [red]Vault deposit failed: {e}[/red]")
            return 1

    return asyncio.run(_deposit())

@cli.command()
@click.option('--format', '-f', type=click.Choice(['table', 'json', 'csv']), default='table')
@click.option('--output', '-o', help='Output file path')
@click.pass_context
def analytics(ctx, format, output):
    """Generate protocol analytics report"""
    async def _analytics():
        cli_app = ctx.obj['cli']
        await cli_app.initialize()

        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                task = progress.add_task("Generating analytics report...", total=None)

                report = await cli_app.analytics.generate_report()

                progress.stop()

                if format == 'json':
                    result = json.dumps(report, indent=2)
                elif format == 'csv':
                    result = cli_app.analytics.to_csv(report)
                else:
                    result = cli_app.analytics.to_table(report)

                if output:
                    Path(output).write_text(result)
                    console.print(f"✅ [green]Report saved to {output}[/green]")
                else:
                    console.print(result)

        except Exception as e:
            console.print(f"❌ [red]Analytics generation failed: {e}[/red]")
            return 1

    return asyncio.run(_analytics())

def main():
    """Main entry point"""
    try:
        cli()
    except KeyboardInterrupt:
        console.print("\n👋 [yellow]Goodbye![/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"❌ [red]Unexpected error: {e}[/red]")
        sys.exit(1)

if __name__ == '__main__':
    main()
