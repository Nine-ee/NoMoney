import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const CreateCampaignPage = () => {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("10");
  const [days, setDays] = useState("7");
  const [isLoading, setIsLoading] = useState(false);

  // 点击部署
  const handleDeploy = async () => {
    const goalNum = parseFloat(goal);
    const daysNum = parseInt(days);

    if (goalNum <= 0) {
      alert("❌ 众筹金额必须大于 0");
      return;
    }
    if (daysNum <= 0) {
      alert("❌ 众筹天数必须大于 0");
      return;
    }

    setIsLoading(true);
    try {
      // 这里用两种方式：
      // 方式1: 调用部署脚本（需要后端配合）
      // 方式2: 前端直接调用合约部署（比较复杂，需要私钥）
      
      // 简单方式：提示用户去终端执行命令
      const command = `npx hardhat run scripts/deploy.js --network localhost --goal ${goalNum} --days ${daysNum}`;
      
      alert(
        `📋 请在终端执行以下命令部署合约：\n\n` +
        `${command}\n\n` +
        `部署完成后，刷新页面即可！`
      );
      
      // 保存参数到 localStorage，供后续显示
      localStorage.setItem("campaignConfig", JSON.stringify({
        goal: goalNum,
        days: daysNum,
        time: new Date().toLocaleString(),
      }));
      
    } catch (error) {
      console.error("部署失败:", error);
      alert("❌ 部署失败，请查看控制台错误信息");
    }
    setIsLoading(false);
  };

  // 快速预设
  const presetOptions = [
    { goal: 5, days: 3, label: "小规模 (5 ETH / 3天)" },
    { goal: 10, days: 7, label: "标准 (10 ETH / 7天)" },
    { goal: 20, days: 14, label: "大规模 (20 ETH / 14天)" },
    { goal: 50, days: 30, label: "大型 (50 ETH / 30天)" },
  ];

  return (
    <div>
      <div className="card">
        <h2>🚀 创建众筹项目</h2>
        <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
          设置众筹目标和时长，部署到区块链
        </p>

        <div style={{ marginBottom: "1.5rem" }}>
          <h3>快速预设</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {presetOptions.map((preset, index) => (
              <button
                key={index}
                className="btn btn-secondary"
                onClick={() => {
                  setGoal(preset.goal.toString());
                  setDays(preset.days.toString());
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
              🎯 众筹目标金额 (ETH)
            </label>
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              min="0.1"
              step="0.1"
              style={{
                width: "100%",
                padding: "0.8rem",
                border: "2px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "1.2rem",
              }}
            />
            <p style={{ color: "#6B7280", fontSize: "0.9rem", marginTop: "0.3rem" }}>
              建议范围: 1 - 100 ETH
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
              ⏰ 众筹时长 (天)
            </label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              min="1"
              step="1"
              style={{
                width: "100%",
                padding: "0.8rem",
                border: "2px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "1.2rem",
              }}
            />
            <p style={{ color: "#6B7280", fontSize: "0.9rem", marginTop: "0.3rem" }}>
              建议范围: 1 - 30 天
            </p>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <button
            className="btn"
            onClick={handleDeploy}
            disabled={isLoading}
            style={{ width: "100%", padding: "1rem", fontSize: "1.2rem" }}
          >
            {isLoading ? "⏳ 部署中..." : "🚀 部署众筹项目"}
          </button>
        </div>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#F3F4F6", borderRadius: "8px" }}>
          <p style={{ fontSize: "0.9rem", color: "#6B7280" }}>
            💡 <strong>提示：</strong>部署需要先在终端启动节点 
            <code style={{ background: "#E5E7EB", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
              npx hardhat node
            </code>
            ，然后在另一个终端执行上方提示的命令。
          </p>
        </div>
      </div>

      {/* 显示当前部署配置 */}
      <div className="card">
        <h3>📊 当前配置预览</h3>
        <div className="stats">
          <div className="stat-item">
            <div className="number">{goal} ETH</div>
            <div className="label">目标金额</div>
          </div>
          <div className="stat-item">
            <div className="number">{days} 天</div>
            <div className="label">众筹时长</div>
          </div>
          <div className="stat-item">
            <div className="number">{parseFloat(goal) / parseFloat(days) || 0} ETH/天</div>
            <div className="label">日均目标</div>
          </div>
        </div>
        <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>
          🦅 早鸟奖励：前10名投资者额外获得 20% 代币
        </p>
      </div>

      {/* 显示历史部署记录 */}
      <div className="card">
        <h3>📋 部署历史</h3>
        {(() => {
          const history = JSON.parse(localStorage.getItem("deployHistory") || "[]");
          if (history.length === 0) {
            return <p style={{ color: "#6B7280" }}>暂无部署记录</p>;
          }
          return (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>目标金额</th>
                  <th>天数</th>
                  <th>部署时间</th>
                </tr>
              </thead>
              <tbody>
                {history.slice().reverse().map((item, index) => (
                  <tr key={index}>
                    <td>{history.length - index}</td>
                    <td>{item.goal} ETH</td>
                    <td>{item.days} 天</td>
                    <td>{item.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
};

export default CreateCampaignPage;