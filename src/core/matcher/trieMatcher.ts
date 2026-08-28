/**
 * Aho-Corasick 多模式匹配自动机 (AC Automaton / Trie)
 * 经典 NLP 字符串多模匹配算法：基于字典树与 Fail 失败指针，在 O(N) 严格线性时间内完成多关键词扫描
 */

export interface TrieMatchResult {
  keyword: string;
  index: number;
  length: number;
  payload?: any;
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  fail: TrieNode | null = null;
  outputs: { keyword: string; payload?: any }[] = [];
}

export class AhoCorasickMatcher {
  private root: TrieNode = new TrieNode();
  private isBuilt = false;

  /**
   * 插入关键词模式
   */
  insert(keyword: string, payload?: any): void {
    if (!keyword) return;
    this.isBuilt = false;
    let curr = this.root;

    for (const char of keyword.toLowerCase()) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
    }

    curr.outputs.push({ keyword, payload });
  }

  /**
   * 批量插入关键词
   */
  insertBatch(keywords: string[]): void {
    for (const kw of keywords) {
      this.insert(kw);
    }
  }

  /**
   * 广度优先搜索 (BFS) 构建 Fail 失败指针与 Output 字典图
   */
  build(): void {
    const queue: TrieNode[] = [];

    // 初始化根节点的直属子节点
    for (const child of this.root.children.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;

      for (const [char, child] of curr.children.entries()) {
        let f = curr.fail;
        while (f && !f.children.has(char)) {
          f = f.fail;
        }

        child.fail = f ? f.children.get(char)! : this.root;

        // 合并后缀命中输出，保证包含关系无遗漏
        if (child.fail.outputs.length > 0) {
          child.outputs.push(...child.fail.outputs);
        }

        queue.push(child);
      }
    }

    this.isBuilt = true;
  }

  /**
   * 在输入文本中执行 O(N) 线性多模式检索
   */
  search(text: string): TrieMatchResult[] {
    if (!this.isBuilt) {
      this.build();
    }

    const results: TrieMatchResult[] = [];
    let curr = this.root;
    const lowerText = text.toLowerCase();

    for (let i = 0; i < lowerText.length; i++) {
      const char = lowerText[i];

      while (curr && !curr.children.has(char) && curr !== this.root) {
        curr = curr.fail || this.root;
      }

      curr = curr.children.get(char) || this.root;

      for (const out of curr.outputs) {
        // 短词（<=3字符，如 "Go", "C", "R"）进行全字边界检查，避免单词内部误伤
        if (out.keyword.length <= 3) {
          const startIdx = i - out.keyword.length + 1;
          const prevChar = startIdx > 0 ? lowerText[startIdx - 1] : ' ';
          const nextChar = i + 1 < lowerText.length ? lowerText[i + 1] : ' ';
          const isAlphaNum = (c: string) => /[a-z0-9_]/i.test(c);

          if (isAlphaNum(prevChar) || isAlphaNum(nextChar)) {
            continue;
          }
        }

        results.push({
          keyword: out.keyword,
          index: i - out.keyword.length + 1,
          length: out.keyword.length,
          payload: out.payload,
        });
      }
    }

    return results;
  }

  /**
   * 获取命中的唯一关键词集合
   */
  searchUnique(text: string): string[] {
    const matches = this.search(text);
    const set = new Set<string>();
    for (const m of matches) {
      set.add(m.keyword);
    }
    return Array.from(set);
  }
}
