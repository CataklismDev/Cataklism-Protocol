"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  Github,
  Twitter,
  MessageCircle
} from "lucide-react";

interface ProtocolStats {
  tvl: number;
  totalStakers: number;
  avgApy: number;
  tokenPrice: number;
  marketCap: number;
  vaultTvl: number;
}

export default function Home() {
  const [stats, setStats] = useState<ProtocolStats>({
    tvl: 52000000,
    totalStakers: 12500,
    avgApy: 18.5,
    tokenPrice: 2.45,
    marketCap: 245000000,
    vaultTvl: 28000000
  });

  const [isConnected, setIsConnected] = useState(false);

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">🌊</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Cataklism Protocol</h1>
                <p className="text-slate-400 text-sm">Next-Generation DeFi Yield Optimization</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button
                onClick={() => setIsConnected(!isConnected)}
                className={isConnected ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
              >
                {isConnected ? "Connected" : "Connect Wallet"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-500">
            🚀 Protocol Live - Mainnet Deployed
          </Badge>

          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Maximize Your
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              DeFi Yields
            </span>
          </h2>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Advanced yield optimization through intelligent strategy allocation,
            automated compounding, and innovative risk management across multiple chains.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-lg px-8 py-3">
              Launch App
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 text-lg px-8 py-3">
              View Documentation
            </Button>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                {formatUSD(stats.tvl)}
              </div>
              <div className="text-slate-400">Total Value Locked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                {formatNumber(stats.totalStakers)}+
              </div>
              <div className="text-slate-400">Active Stakers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-green-400 mb-2">
                {stats.avgApy}%
              </div>
              <div className="text-slate-400">Average APY</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                ${stats.tokenPrice}
              </div>
              <div className="text-slate-400">CTKL Price</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-white mb-4">
              Why Choose Cataklism?
            </h3>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Built with cutting-edge technology and battle-tested security practices
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <CardTitle className="text-white">Smart Yield Optimization</CardTitle>
                <CardDescription className="text-slate-400">
                  AI-powered strategy allocation automatically maximizes returns across multiple DeFi protocols
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Current Optimization</span>
                    <span className="text-green-400">94%</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <CardTitle className="text-white">Battle-Tested Security</CardTitle>
                <CardDescription className="text-slate-400">
                  Multi-signature governance, emergency pause mechanisms, and comprehensive audits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Audit Score</span>
                    <Badge className="bg-green-600/20 text-green-300">96/100</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Bug Bounty</span>
                    <span className="text-white text-sm">$100k Pool</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <CardTitle className="text-white">Cross-Chain Compatible</CardTitle>
                <CardDescription className="text-slate-400">
                  Deploy across Ethereum, Polygon, BSC, and Arbitrum with unified liquidity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-slate-700/50 rounded">
                    <div className="text-sm font-medium text-white">Ethereum</div>
                    <div className="text-xs text-green-400">Live</div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/50 rounded">
                    <div className="text-sm font-medium text-white">Polygon</div>
                    <div className="text-xs text-green-400">Live</div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/50 rounded">
                    <div className="text-sm font-medium text-white">BSC</div>
                    <div className="text-xs text-yellow-400">Soon</div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/50 rounded">
                    <div className="text-sm font-medium text-white">Arbitrum</div>
                    <div className="text-xs text-yellow-400">Soon</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Vault Performance */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-white mb-4">
              Live Vault Performance
            </h3>
            <p className="text-xl text-slate-300">
              Real-time metrics from our active yield strategies
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-300 text-sm font-medium flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Vault TVL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatUSD(stats.vaultTvl)}
                </div>
                <p className="text-green-400 text-sm mt-1">+12.5% this week</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-300 text-sm font-medium flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Vault APY
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  22.8%
                </div>
                <p className="text-slate-400 text-sm mt-1">Auto-compounding</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-300 text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Active Strategies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  12
                </div>
                <p className="text-blue-400 text-sm mt-1">Across 4 protocols</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-300 text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  24h Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatUSD(1250000)}
                </div>
                <p className="text-green-400 text-sm mt-1">+8.2% vs yesterday</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20">
        <div className="container mx-auto text-center">
          <h3 className="text-4xl font-bold text-white mb-4">
            Ready to Optimize Your Yields?
          </h3>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Join thousands of users already earning maximum returns with Cataklism Protocol
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-lg px-8 py-3">
              Start Earning Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 text-lg px-8 py-3">
              View Analytics
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">🌊</span>
              </div>
              <span className="text-white font-semibold">Cataklism Protocol</span>
            </div>

            <div className="flex items-center space-x-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-400">
            <p>&copy; 2024 Cataklism Protocol. Built with ❤️ for the DeFi community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
