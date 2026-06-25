const strategies = {
  covered: {
    label: "用已持有股票产生现金流",
    title: "备兑看涨",
    risk: "中等风险",
    summary:
      "持有100股正股，同时卖出一张看涨期权。你先收到权利金，但股价高于行权价后的上涨收益会被限制。",
    bestMarket: "中性到温和看涨",
    primaryGoal: "从已有正股中获得权利金收入",
    mainRisk: "正股下跌幅度超过收到的权利金",
    tradeoff: "卖出看涨的行权价以上收益被封顶",
    caption: "备兑看涨可以缓冲小幅下跌，但不能完全保护正股暴跌。",
  },
  longcall: {
    label: "有限风险的上涨杠杆",
    title: "买入看涨",
    risk: "高风险",
    summary:
      "买入看涨期权，用比买入100股更少的资金获得上涨敞口。最大亏损是你支付的权利金。",
    bestMarket: "明确看涨，并且有清晰时间窗口",
    primaryGoal: "用有限最大亏损获得上涨杠杆",
    mainRisk: "如果股价涨得不够，期权可能到期归零",
    tradeoff: "时间价值损耗和隐含波动率变化可能不利",
    caption: "买入看涨亏损有限、上涨弹性高，但需要股价在到期前真正上涨。",
  },
  protective: {
    label: "给正股买保险",
    title: "保护性看跌",
    risk: "风险明确",
    summary:
      "持有正股，同时买入看跌期权。看跌期权会在行权价附近建立保护底线，类似支付保险费。",
    bestMarket: "长期看涨，但短期担心下跌",
    primaryGoal: "限制下跌，同时保留上涨空间",
    mainRisk: "如果正股上涨，权利金成本会降低总收益",
    tradeoff: "高波动环境下保护成本可能很贵",
    caption: "保护性看跌在行权价以下限制损失，同时保留正股上涨敞口。",
  },
  cashput: {
    label: "等待低位买入时收权利金",
    title: "现金担保看跌",
    risk: "类似持股风险",
    summary:
      "卖出看跌期权，同时准备足够现金应对被指派买入。你因为愿意在行权价买入股票而获得权利金。",
    bestMarket: "中性到看涨，愿意更低价买入",
    primaryGoal: "以折扣价买入股票，或保留权利金",
    mainRisk: "被指派后，股票继续大幅下跌",
    tradeoff: "盈利上限是收到的权利金",
    caption: "现金担保看跌的收入被封顶；若被指派，下跌风险接近持有正股。",
  },
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  label: document.getElementById("strategy-label"),
  title: document.getElementById("strategy-title"),
  risk: document.getElementById("strategy-risk"),
  summary: document.getElementById("strategy-summary"),
  bestMarket: document.getElementById("best-market"),
  primaryGoal: document.getElementById("primary-goal"),
  mainRisk: document.getElementById("main-risk"),
  tradeoff: document.getElementById("tradeoff"),
  caption: document.getElementById("chart-caption"),
  canvas: document.getElementById("payoffChart"),
  stockPrice: document.getElementById("stockPrice"),
  strikePrice: document.getElementById("strikePrice"),
  premium: document.getElementById("premium"),
  contracts: document.getElementById("contracts"),
  horizonValue: document.getElementById("horizonValue"),
  horizonUnit: document.getElementById("horizonUnit"),
  downMove: document.getElementById("downMove"),
  upMove: document.getElementById("upMove"),
  breakeven: document.getElementById("breakeven"),
  maxProfit: document.getElementById("maxProfit"),
  maxLoss: document.getElementById("maxLoss"),
  capitalNeeded: document.getElementById("capitalNeeded"),
  horizonDays: document.getElementById("horizonDays"),
  timePressure: document.getElementById("timePressure"),
  scenarioRows: document.getElementById("scenarioRows"),
  methodFormula: document.getElementById("methodFormula"),
};

let current = "covered";

function money(value) {
  if (!Number.isFinite(value)) return "不适用";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return "不适用";
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function getInputs() {
  const unit = els.horizonUnit.value;
  const horizonValue = clamp(Math.round(Number(els.horizonValue.value) || 30), 1, 3650);
  return {
    stock: clamp(Number(els.stockPrice.value) || 100, 1, 10000),
    strike: clamp(Number(els.strikePrice.value) || 110, 1, 10000),
    premium: clamp(Number(els.premium.value) || 1, 0.01, 10000),
    contracts: clamp(Math.round(Number(els.contracts.value) || 1), 1, 1000),
    horizonValue,
    horizonUnit: unit,
    horizonDays: horizonToDays(horizonValue, unit),
    downMove: clamp(Number(els.downMove.value) || -10, -90, 0),
    upMove: clamp(Number(els.upMove.value) || 10, 0, 300),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function horizonToDays(value, unit) {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  if (unit === "years") return value * 365;
  return value;
}

function payoffFor(strategy, endPrice, input) {
  const { stock, strike, premium } = input;
  const stockOnly = endPrice - stock;

  if (strategy === "covered") {
    return stockOnly + premium - Math.max(0, endPrice - strike);
  }
  if (strategy === "longcall") {
    return Math.max(0, endPrice - strike) - premium;
  }
  if (strategy === "protective") {
    return stockOnly + Math.max(0, strike - endPrice) - premium;
  }
  if (strategy === "cashput") {
    return premium - Math.max(0, strike - endPrice);
  }
  return 0;
}

function stockOnlyPayoff(endPrice, input) {
  return endPrice - input.stock;
}

function metricsFor(strategy, input) {
  const multiplier = input.contracts * 100;
  if (strategy === "covered") {
    return {
      breakeven: input.stock - input.premium,
      maxProfit: (input.strike - input.stock + input.premium) * multiplier,
      maxLoss: (input.stock - input.premium) * multiplier,
      capital: input.stock * multiplier,
    };
  }
  if (strategy === "longcall") {
    return {
      breakeven: input.strike + input.premium,
      maxProfit: Infinity,
      maxLoss: input.premium * multiplier,
      capital: input.premium * multiplier,
    };
  }
  if (strategy === "protective") {
    return {
      breakeven: input.stock + input.premium,
      maxProfit: Infinity,
      maxLoss: (input.stock - input.strike + input.premium) * multiplier,
      capital: (input.stock + input.premium) * multiplier,
    };
  }
  return {
    breakeven: input.strike - input.premium,
    maxProfit: input.premium * multiplier,
    maxLoss: (input.strike - input.premium) * multiplier,
    capital: input.strike * multiplier,
  };
}

function updateText() {
  const data = strategies[current];
  els.label.textContent = data.label;
  els.title.textContent = data.title;
  els.risk.textContent = data.risk;
  els.summary.textContent = data.summary;
  els.bestMarket.textContent = data.bestMarket;
  els.primaryGoal.textContent = data.primaryGoal;
  els.mainRisk.textContent = data.mainRisk;
  els.tradeoff.textContent = data.tradeoff;
  els.caption.textContent = data.caption;
  els.methodFormula.textContent = formulaFor(current);
}

function formulaFor(strategy) {
  if (strategy === "covered") {
    return "备兑看涨收益 = 正股收益 + 收到权利金 - 卖出看涨的内在价值。";
  }
  if (strategy === "longcall") {
    return "买入看涨收益 = max(期末股价 - 行权价, 0) - 支付的权利金。";
  }
  if (strategy === "protective") {
    return "保护性看跌收益 = 正股收益 + max(行权价 - 期末股价, 0) - 支付的权利金。";
  }
  return "现金担保看跌收益 = 收到权利金 - max(行权价 - 期末股价, 0)。";
}

function updateMetrics(input) {
  const metrics = metricsFor(current, input);
  const totalPremium = input.premium * input.contracts * 100;
  const pressure = totalPremium / Math.max(input.horizonDays, 1);
  els.breakeven.textContent = money(metrics.breakeven);
  els.maxProfit.textContent = metrics.maxProfit === Infinity ? "不封顶" : money(metrics.maxProfit);
  els.maxLoss.textContent = money(Math.max(0, metrics.maxLoss));
  els.capitalNeeded.textContent = money(metrics.capital);
  els.horizonDays.textContent = `${input.horizonDays}天`;
  els.timePressure.textContent =
    current === "longcall" || current === "protective"
      ? `成本 ${money(pressure)}/天`
      : `收入 ${money(pressure)}/天`;
}

function updateScenarios(input) {
  const metrics = metricsFor(current, input);
  const multiplier = input.contracts * 100;
  const rows = [
    { key: "down", name: `下跌 ${Math.abs(input.downMove)}%`, endPrice: input.stock * (1 + input.downMove / 100) },
    { key: "flat", name: "持平 0%", endPrice: input.stock },
    { key: "up", name: `上涨 ${input.upMove}%`, endPrice: input.stock * (1 + input.upMove / 100) },
  ];

  els.scenarioRows.innerHTML = rows
    .map((row) => {
      const strategyPL = payoffFor(current, row.endPrice, input) * multiplier;
      const stockPL = stockOnlyPayoff(row.endPrice, input) * multiplier;
      const strategyReturn = strategyPL / Math.max(metrics.capital, 1);
      const annualized = annualize(strategyReturn, input.horizonDays);
      return `
        <tr>
          <td><span class="scenario-name ${row.key}">${row.name}</span></td>
          <td>${money(row.endPrice)}</td>
          <td class="${valueClass(strategyPL)}">${signedMoney(strategyPL)}</td>
          <td class="${valueClass(strategyReturn)}">${percent(strategyReturn)}</td>
          <td class="${valueClass(annualized)}">${percent(annualized)}</td>
          <td class="${valueClass(stockPL)}">${signedMoney(stockPL)}</td>
        </tr>
      `;
    })
    .join("");
}

function annualize(returnValue, days) {
  if (!Number.isFinite(returnValue) || days <= 0) return 0;
  if (returnValue <= -0.99) return -1;
  return Math.pow(1 + returnValue, 365 / days) - 1;
}

function signedMoney(value) {
  if (value > 0) return `+${money(value)}`;
  return money(value);
}

function valueClass(value) {
  if (value > 0.000001) return "positive";
  if (value < -0.000001) return "negative";
  return "neutral";
}

function drawChart(input) {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = { top: 30, right: 28, bottom: 46, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);

  const minPrice = Math.max(0, input.stock * 0.55);
  const maxPrice = input.stock * 1.55;
  const points = Array.from({ length: 80 }, (_, i) => minPrice + ((maxPrice - minPrice) * i) / 79);
  const strategyValues = points.map((p) => payoffFor(current, p, input));
  const stockValues = points.map((p) => stockOnlyPayoff(p, input));
  const allValues = [...strategyValues, ...stockValues, 0];
  const minPayoff = Math.min(...allValues);
  const maxPayoff = Math.max(...allValues);
  const yMin = minPayoff - Math.max(5, (maxPayoff - minPayoff) * 0.16);
  const yMax = maxPayoff + Math.max(5, (maxPayoff - minPayoff) * 0.16);

  const x = (price) => pad.left + ((price - minPrice) / (maxPrice - minPrice)) * plotW;
  const y = (payoff) => pad.top + (1 - (payoff - yMin) / (yMax - yMin)) * plotH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e5ebf1";
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#687589";

  for (let i = 0; i <= 4; i++) {
    const yy = pad.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(width - pad.right, yy);
    ctx.stroke();
    const val = yMax - ((yMax - yMin) * i) / 4;
    ctx.fillText(Math.round(val).toString(), 10, yy + 4);
  }

  const zeroY = y(0);
  ctx.strokeStyle = "#9aa6b2";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(width - pad.right, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  drawLine(ctx, points, stockValues, x, y, "#7d8795", 2);
  drawLine(ctx, points, strategyValues, x, y, "#1e7c51", 4);

  const metrics = metricsFor(current, input);
  if (Number.isFinite(metrics.breakeven) && metrics.breakeven >= minPrice && metrics.breakeven <= maxPrice) {
    const bx = x(metrics.breakeven);
    ctx.strokeStyle = "#b93a3a";
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(bx, pad.top);
    ctx.lineTo(bx, height - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#b93a3a";
    ctx.fillText("盈亏平衡", bx + 6, pad.top + 14);
  }

  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#526173";
  ctx.fillText("到期时股价", width / 2 - 38, height - 12);
  ctx.save();
  ctx.translate(16, height / 2 + 44);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("每股盈利 / 亏损", 0, 0);
  ctx.restore();

  const ticks = [minPrice, input.stock, input.strike, maxPrice];
  ticks.forEach((tick) => {
    const tx = x(tick);
    ctx.strokeStyle = "#d9e0e8";
    ctx.beginPath();
    ctx.moveTo(tx, height - pad.bottom);
    ctx.lineTo(tx, height - pad.bottom + 6);
    ctx.stroke();
    ctx.fillStyle = "#687589";
    ctx.fillText(`$${Math.round(tick)}`, tx - 13, height - pad.bottom + 22);
  });
}

function drawLine(ctx, xs, ys, mapX, mapY, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  xs.forEach((xVal, i) => {
    const px = mapX(xVal);
    const py = mapY(ys[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function render() {
  const input = getInputs();
  updateText();
  updateMetrics(input);
  updateScenarios(input);
  drawChart(input);
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    current = tab.dataset.strategy;
    els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    render();
  });
});

[els.stockPrice, els.strikePrice, els.premium, els.contracts, els.horizonValue, els.horizonUnit, els.downMove, els.upMove].forEach((input) => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
});

render();
