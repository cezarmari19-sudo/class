import Svg, { Path, Circle, G } from "react-native-svg";
import { View, Text } from "react-native";
import { makeStyles } from "@/src/theme";

type Props = {
  score: number; // 0..100
  size?: number;
};

export function scoreColor(score: number): string {
  if (score <= 30) return "#D50000"; // red
  if (score <= 60) return "#FFB300"; // yellow (better contrast than pure yellow)
  return "#00C853"; // green
}

// Semicircle gauge, 0 (left) → 100 (right)
export function ScoreGauge({ score, size = 260 }: Props) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(100, score));
  const w = size;
  const h = size / 2 + 40;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;
  const strokeWidth = 20;
  const color = scoreColor(clamped);

  const arcPath = (startPct: number, endPct: number) => {
    const start = polar(cx, cy, r, 180 + (startPct / 100) * 180);
    const end = polar(cx, cy, r, 180 + (endPct / 100) * 180);
    const largeArc = endPct - startPct > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const needleAngle = 180 + (clamped / 100) * 180;
  const needleEnd = polar(cx, cy, r - 12, needleAngle);

  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "flex-start" }}>
      <Svg width={w} height={h}>
        {/* Background full arc */}
        <Path d={arcPath(0, 100)} stroke="#EEEEEE" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        {/* Red zone 0-30 */}
        <Path d={arcPath(0, 30)} stroke="#D50000" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" opacity={0.35} />
        {/* Yellow zone 30-60 */}
        <Path d={arcPath(30, 60)} stroke="#FFB300" strokeWidth={strokeWidth} fill="none" opacity={0.35} />
        {/* Green zone 60-100 */}
        <Path d={arcPath(60, 100)} stroke="#00C853" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" opacity={0.35} />
        {/* Progress arc */}
        {clamped > 0 && (
          <Path
            d={arcPath(0, clamped)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* Needle */}
        <G>
          <Path
            d={`M ${cx} ${cy} L ${needleEnd.x} ${needleEnd.y}`}
            stroke="#1C1C1E"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle cx={cx} cy={cy} r={8} fill="#1C1C1E" />
        </G>
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color }]} testID="gauge-score-value">
          {clamped}
        </Text>
        <Text style={styles.max}>/ 100</Text>
      </View>
    </View>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const useStyles = makeStyles((colors) => ({
  center: {
    marginTop: -30,
    alignItems: "center",
  },
  score: {
    fontSize: 56,
    fontWeight: "800",
  },
  max: {
    fontSize: 14,
    color: colors.muted,
    marginTop: -4,
  },
}));
