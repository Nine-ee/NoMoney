import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { getCrowdfundingContractReadOnly } from "../utils/contract";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DashboardPage = () => {
  const [fundingHistory, setFundingHistory] = useState([]);
  const [participantHistory, setParticipantHistory] = useState([]);
  const [currentRaised, setCurrentRaised] = useState("0");
  const [currentGoal, setCurrentGoal] = useState("0");
  const [currentParticipants, setCurrentParticipants] = useState(0);

  // ============ 加载链上实时数据 ============
  useEffect(() => {
    const loadChainData = async () => {
      try {
        const contract = getCrowdfundingContractReadOnly();
        const info = await contract.getCampaignInfo();
        setCurrentRaised(ethers.utils.formatEther(info.raised));
        setCurrentGoal(ethers.utils.formatEther(info.target));
        setCurrentParticipants(Number(info.participantCount));
        console.log("[看板] 链上数据更新:", {
          raised: ethers.utils.formatEther(info.raised),
          goal: ethers.utils.formatEther(info.target),
          participants: Number(info.participantCount)
        });
      } catch (e) {
        console.error("[看板] 加载链上数据失败:", e);
      }
    };

    loadChainData();
    const interval = setInterval(loadChainData, 15000); // 每 15 秒刷新
    return () => clearInterval(interval);
  }, []);

  // ============ 加载历史数据（来自 localStorage） ============
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("fundingHistory") || "[]");
    console.log(`[看板] 加载到 ${history.length} 条历史数据`);
    if (history.length > 0) {
      // setFundingHistory(history.map(d => ({ time: d.time, amount: d.amount })));
      // setParticipantHistory(history.map(d => ({ time: d.time, count: d.count })));
      const dailyData = {};
      history.forEach(d => {
        const dateKey = d.time.split(" ")[0];
        dailyData[dateKey] = { time: dateKey, amount: d.amount, count: d.count };
      });
      const dailyArray = Object.values(dailyData);
      console.log(`[看板] 聚合后 ${dailyArray.length} 条每日数据`);
      setFundingHistory(dailyArray.map(d => ({ time: d.time, amount: d.amount })));
      setParticipantHistory(dailyArray.map(d => ({ time: d.time, count: d.count })));
    }
  }, []);

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "众筹数据趋势" },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  const fundingData = {
    labels: fundingHistory.map(d => d.time),
    datasets: [
      {
        label: "筹集金额 (ETH)",
        data: fundingHistory.map(d => d.amount),
        borderColor: "rgb(79, 70, 229)",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const participantData = {
    labels: participantHistory.map(d => d.time),
    datasets: [
      {
        label: "参与人数",
        data: participantHistory.map(d => d.count),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  return (
    <div>
      <div className="card">
        <h2>数据看板</h2>
        <p style={{ color: "#6B7280" }}>众筹数据实时分析</p>
      </div>

      <div className="card">
        <h3>当前众筹状态</h3>
        <div className="stats">
          <div className="stat-item">
            <div className="number">{parseFloat(currentRaised).toFixed(2)} ETH</div>
            <div className="label">已筹金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{parseFloat(currentGoal).toFixed(2)} ETH</div>
            <div className="label">目标金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{currentParticipants}</div>
            <div className="label">参与人数</div>
          </div>
          <div className="stat-item">
            <div className="number">
              {parseFloat(currentGoal) > 0 ? ((parseFloat(currentRaised) / parseFloat(currentGoal)) * 100).toFixed(1) : 0}%
            </div>
            <div className="label">完成度</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>资金筹集曲线</h3>
        {fundingHistory.length > 0 ? (
          <Line options={lineOptions} data={fundingData} />
        ) : (
          <p style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
            暂无数据，开始投资后自动记录
          </p>
        )}
      </div>

      <div className="card">
        <h3>参与者增长趋势</h3>
        {participantHistory.length > 0 ? (
          <Line options={lineOptions} data={participantData} />
        ) : (
          <p style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
            暂无数据，开始投资后自动记录
          </p>
        )}
      </div>

      <div className="card">
        <h3>统计数据</h3>
        <div className="stats">
          <div className="stat-item">
            <div className="number">
              {fundingHistory.length > 0 ? fundingHistory[fundingHistory.length - 1].amount.toFixed(2) : parseFloat(currentRaised).toFixed(2)}
            </div>
            <div className="label">最新筹集 (ETH)</div>
          </div>
          <div className="stat-item">
            <div className="number">
              {participantHistory.length > 0 ? participantHistory[participantHistory.length - 1].count : currentParticipants}
            </div>
            <div className="label">最新参与人数</div>
          </div>
          <div className="stat-item">
            <div className="number">{fundingHistory.length}</div>
            <div className="label">数据点数量</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;