import { useEffect, useState } from "react";
import { formatTime, parseTime } from "../lib";

interface Props {
  value: number;
  onChange: (sec: number) => void;
  invalid?: boolean;
}

/** mm:ss 文本输入；非法输入不提交 */
export default function TimeInput({ value, onChange, invalid }: Props) {
  const [text, setText] = useState(formatTime(value));

  useEffect(() => {
    setText(formatTime(value));
  }, [value]);

  return (
    <input
      className={invalid ? "time-input invalid" : "time-input"}
      value={text}
      size={5}
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
        const sec = parseTime(e.target.value);
        if (sec !== null) onChange(sec);
      }}
      onBlur={() => setText(formatTime(value))}
      placeholder="mm:ss"
    />
  );
}
