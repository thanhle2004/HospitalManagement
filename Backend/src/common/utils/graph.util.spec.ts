import {
  findReadyNodes,
  topologicalSort,
  wouldCreateCycle,
} from './graph.util';

describe('graph.util', () => {
  describe('topologicalSort', () => {
    it('trả về [] khi đồ thị rỗng', () => {
      expect(topologicalSort([], [])).toEqual([]);
    });

    it('trả về đúng thứ tự cho chuỗi tuyến tính A -> B -> C', () => {
      const nodes = ['A', 'B', 'C'];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ];
      expect(topologicalSort(nodes, edges)).toEqual(['A', 'B', 'C']);
    });

    it('xử lý đúng node độc lập không có cạnh nào (không LOCKED mãi mãi)', () => {
      const nodes = ['A', 'B'];
      const result = topologicalSort(nodes, []);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(['A', 'B']));
    });

    it('xử lý đúng ví dụ trong spec §6: A→C, B→E, D độc lập', () => {
      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const edges = [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'E' },
      ];
      const result = topologicalSort(nodes, edges);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(5);
      // A phải đứng trước C; B phải đứng trước E — D không ràng buộc gì
      expect(result!.indexOf('A')).toBeLessThan(result!.indexOf('C'));
      expect(result!.indexOf('B')).toBeLessThan(result!.indexOf('E'));
    });

    it('trả về null khi đồ thị có chu trình trực tiếp (A -> B -> A)', () => {
      const nodes = ['A', 'B'];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ];
      expect(topologicalSort(nodes, edges)).toBeNull();
    });

    it('trả về null khi đồ thị có chu trình gián tiếp (A -> B -> C -> A)', () => {
      const nodes = ['A', 'B', 'C'];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ];
      expect(topologicalSort(nodes, edges)).toBeNull();
    });

    it('phát hiện chu trình dù chỉ 1 phần đồ thị bị ảnh hưởng (phần còn lại vẫn là DAG hợp lệ)', () => {
      // D -> E hợp lệ, nhưng A -> B -> C -> A là chu trình
      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
        { from: 'D', to: 'E' },
      ];
      expect(topologicalSort(nodes, edges)).toBeNull();
    });

    it('bỏ qua edge trỏ tới node không tồn tại trong danh sách nodes (dữ liệu bất nhất)', () => {
      const nodes = ['A', 'B'];
      const edges = [{ from: 'A', to: 'ZZZ' }];
      const result = topologicalSort(nodes, edges);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });
  });

  describe('wouldCreateCycle', () => {
    it('trả về false khi thêm edge hợp lệ, không tạo chu trình', () => {
      const nodes = [1, 2, 3];
      const existing = [{ from: 1, to: 2 }];
      const candidate = [{ from: 2, to: 3 }];
      expect(wouldCreateCycle(nodes, existing, candidate)).toBe(false);
    });

    it('trả về true khi thêm edge sẽ tạo chu trình', () => {
      // Đồ thị hiện có: 1 -> 2 -> 3. Thêm 3 -> 1 sẽ tạo chu trình.
      const nodes = [1, 2, 3];
      const existing = [
        { from: 1, to: 2 },
        { from: 2, to: 3 },
      ];
      const candidate = [{ from: 3, to: 1 }];
      expect(wouldCreateCycle(nodes, existing, candidate)).toBe(true);
    });

    it('trả về true khi candidate edge là self-loop', () => {
      const nodes = [1];
      expect(wouldCreateCycle(nodes, [], [{ from: 1, to: 1 }])).toBe(true);
    });
  });

  describe('findReadyNodes', () => {
    it('trả về mọi node không có predecessor khi completed rỗng (đúng spec §6 ví dụ A→C,B→E,D)', () => {
      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const edges = [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'E' },
      ];
      const ready = findReadyNodes(nodes, edges, new Set());
      expect(ready.sort()).toEqual(['A', 'B', 'D']);
    });

    it('mở khoá đúng node kế tiếp khi tiền nhiệm hoàn thành', () => {
      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const edges = [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'E' },
      ];
      // A đã hoàn thành -> C phải READY; B chưa xong -> E vẫn LOCKED
      const ready = findReadyNodes(nodes, edges, new Set(['A']));
      expect(ready).toContain('C');
      expect(ready).not.toContain('E');
    });

    it('không trả lại node đã có trong completed (không tự lặp vô hạn)', () => {
      const nodes = ['A', 'B'];
      const edges = [{ from: 'A', to: 'B' }];
      const ready = findReadyNodes(nodes, edges, new Set(['A', 'B']));
      expect(ready).toEqual([]);
    });

    it('1 node chỉ READY khi TẤT CẢ predecessor đều hoàn thành (multi-dependency)', () => {
      // F phụ thuộc cả A và B
      const nodes = ['A', 'B', 'F'];
      const edges = [
        { from: 'A', to: 'F' },
        { from: 'B', to: 'F' },
      ];
      expect(findReadyNodes(nodes, edges, new Set(['A']))).not.toContain('F');
      expect(findReadyNodes(nodes, edges, new Set(['A', 'B']))).toContain('F');
    });
  });
});
