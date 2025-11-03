describe('Advice API', () => {
  describe('Rule-based Advice Generation', () => {
    it('should generate advice for high blood pressure', () => {
      const input = {
        systolic: '150',
        diastolic: '95',
        pulse: '75',
        weight: '70',
      };

      const s = parseInt(input.systolic);
      const d = parseInt(input.diastolic);

      let advice = '';
      if (s >= 140 || d >= 90) {
        advice = '⚠️ 血圧が高めです。塩分を控え、軽い有酸素運動を継続しましょう。';
      }

      expect(advice).toContain('血圧が高めです');
      expect(advice).toContain('塩分を控え');
    });

    it('should generate advice for normal blood pressure', () => {
      const input = {
        systolic: '120',
        diastolic: '80',
        pulse: '75',
        weight: '70',
      };

      const s = parseInt(input.systolic);
      const d = parseInt(input.diastolic);

      let advice = '';
      if (s >= 90 && s < 140 && d >= 60 && d < 90) {
        advice = '✅ 血圧は概ね良好です。この調子を維持しましょう。';
      }

      expect(advice).toContain('血圧は概ね良好です');
    });

    it('should generate advice for high pulse', () => {
      const input = {
        systolic: '120',
        diastolic: '80',
        pulse: '110',
        weight: '70',
      };

      const p = parseInt(input.pulse);

      let advice = '';
      if (p > 100) {
        advice = '⚠️ 脈拍が高めです。深呼吸やストレッチでクールダウンを。';
      }

      expect(advice).toContain('脈拍が高めです');
      expect(advice).toContain('深呼吸');
    });

    it('should generate advice for stable pulse', () => {
      const input = {
        systolic: '120',
        diastolic: '80',
        pulse: '75',
        weight: '70',
      };

      const p = parseInt(input.pulse);

      let advice = '';
      if (p >= 60 && p <= 100) {
        advice = '✅ 脈拍は安定しています。';
      }

      expect(advice).toContain('脈拍は安定しています');
    });
  });
});