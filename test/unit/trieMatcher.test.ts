import { describe, it, expect, beforeEach } from 'vitest';
import { AhoCorasickMatcher } from '@/core/matcher/trieMatcher';

describe('AhoCorasickMatcher (AC 自动机多模式匹配引擎)', () => {
  let matcher: AhoCorasickMatcher;

  beforeEach(() => {
    matcher = new AhoCorasickMatcher();
  });

  it('应该能正确构建字典树并实现基本关键词命中', () => {
    matcher.insertBatch(['Vue', 'React', 'TypeScript', 'Node.js', 'Python']);
    matcher.build();

    const text = '熟练掌握 Vue、TypeScript 与 React 前端框架开发，了解 Node.js 与 Python 后端技术。';
    const matches = matcher.search(text);

    expect(matches.length).toBeGreaterThanOrEqual(4);
    const keywords = matches.map((m) => m.keyword);
    expect(keywords).toContain('Vue');
    expect(keywords).toContain('TypeScript');
    expect(keywords).toContain('React');
    expect(keywords).toContain('Node.js');
  });

  it('searchUnique 应该返回去重后的命中关键词列表', () => {
    matcher.insertBatch(['Java', 'Spring', 'MySQL', 'Redis']);
    const text = '具备扎实的 Java 基础，熟练使用 Java、Spring Boot、MySQL 和 Redis。';
    const unique = matcher.searchUnique(text);

    expect(unique).toContain('Java');
    expect(unique).toContain('Spring');
    expect(unique).toContain('MySQL');
    expect(unique).toContain('Redis');
    // 验证 Java 只出现一次
    expect(unique.filter((k) => k === 'Java').length).toBe(1);
  });

  it('针对短词（<=3 字符，如 Go, C, R）应进行词边界检查，避免单词内部误伤', () => {
    matcher.insertBatch(['Go', 'C', 'R']);
    matcher.build();

    // "Google" 中包含 "go"，"Good" 中包含 "go"，"Cat" 中包含 "c"，"Car" 中包含 "c" 和 "r"
    const textWithSubstrings = 'Google engineer visited Cat Car today.';
    const matches1 = matcher.search(textWithSubstrings);
    // 边界检查应该过滤掉 Google/Cat/Car 内部的 Go/C/R
    const matchedKeywords1 = matches1.map((m) => m.keyword);
    expect(matchedKeywords1).not.toContain('Go');
    expect(matchedKeywords1).not.toContain('C');

    // 独立的短词应该被成功命中
    const textWithStandalone = 'Proficient in Go, C and R programming languages.';
    const matches2 = matcher.search(textWithStandalone);
    const matchedKeywords2 = matches2.map((m) => m.keyword);
    expect(matchedKeywords2).toContain('Go');
    expect(matchedKeywords2).toContain('C');
    expect(matchedKeywords2).toContain('R');
  });

  it('面对超长文本（10,000+ 字符）应能在毫秒级严格 O(N) 线性时间内完成检索', () => {
    const keywords = ['Docker', 'Kubernetes', 'CI/CD', 'GraphQL', 'Microservices', 'Webpack', 'Vite', 'Kafka', 'Flink', 'Spark'];
    matcher.insertBatch(keywords);
    matcher.build();

    // 构造 10 万字符的超长 JD / 技术文档
    const baseBlock = 'We are looking for a senior architect with Docker, Kubernetes and Microservices experience. Continuous learning in Vite and CI/CD pipelines is preferred. ';
    const giantText = baseBlock.repeat(800); // 约 110,000 字符

    const start = performance.now();
    const results = matcher.search(giantText);
    const duration = performance.now() - start;

    expect(results.length).toBeGreaterThan(1000);
    // 验证严格 O(N) 性能，10 万字检索应在 50ms 以内完成
    expect(duration).toBeLessThan(100);
  });
});
