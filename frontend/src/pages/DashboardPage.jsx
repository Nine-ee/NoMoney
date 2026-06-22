import React, { useState, useEffect } from "react";
import { Line, Bar } from "react-chartjs-2";
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

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("fundingHistory") || "[]");
    if (history.length > 0) {
      setFundingHistory(history.map(d => ({ time: d.time, amount: d.amount })));
      setParticipantHistory(history.map(d => ({ time: d.time, count: d.count })));
    }
  }, []);

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "众筹数据趋势",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
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

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "参与人数分布",
      },
    },
  };

  return (
    <div>
      <div className="card">
        <h2>📊 数据看板</h2>
        <p style={{ color: "#6B7280" }}>众筹数据实时分析</p>
      </div>

      <div className="card">
        <h3>💰 资金筹集曲线</h3>
        {fundingHistory.length > 0 ? (
          <Line options={lineOptions} data={fundingData} />
        ) : (
          <p style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
            暂无数据，开始投资后自动记录
          </p>
        )}
      </div>

      <div className="card">
        <h3>👥 参与者增长趋势</h3>
        {participantHistory.length > 0 ? (
          <Line options={lineOptions} data={participantData} />
        ) : (
          <p style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
            暂无数据，开始投资后自动记录
          </p>
        )}
      </div>

      <div className="card">
        <h3>📈 统计数据</h3>
        <div className="stats">
          <div className="stat-item">
            <div className="number">
              {fundingHistory.length > 0 ? fundingHistory[fundingHistory.length - 1].amount.toFixed(2) : 0}
            </div>
            <div className="label">最新筹集 (ETH)</div>
          </div>
          <div className="stat-item">
            <div className="number">
              {participantHistory.length > 0 ? participantHistory[participantHistory.length - 1].count : 0}
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