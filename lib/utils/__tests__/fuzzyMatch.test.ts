import { matchAnswer } from '../fuzzyMatch';

describe('matchAnswer', () => {
  describe('coincidencia exacta', () => {
    it('devuelve "exact" cuando el texto es idéntico', () => {
      const result = matchAnswer('casa', 'casa');
      expect(result.result).toBe('exact');
      expect(result.distance).toBe(0);
    });

    it('ignora mayúsculas/minúsculas', () => {
      const result = matchAnswer('CASA', 'casa');
      expect(result.result).toBe('exact');
    });

    it('ignora espacios al principio/final y colapsa espacios internos', () => {
      const result = matchAnswer('  make   a decision  ', 'make a decision');
      expect(result.result).toBe('exact');
    });

    it('normaliza distintos tipos de apóstrofo', () => {
      const result = matchAnswer("don't", 'don’t');
      expect(result.result).toBe('exact');
    });
  });

  describe('umbral de tolerancia según longitud de la respuesta', () => {
    it('respuesta corta (<=4 chars, umbral 1): distancia 1 es "close", distancia 3 es "wrong"', () => {
      // "casa" vs "caza": sustitución s->z en la posición 3, distancia 1
      expect(matchAnswer('caza', 'casa').result).toBe('close');
      // "casa" vs "cozo": sustituciones en posiciones 2, 3 y 4, distancia 3
      expect(matchAnswer('cozo', 'casa').result).toBe('wrong');
    });

    it('respuesta media (5-8 chars, umbral 2): distancia 2 es "close", distancia 3 es "wrong"', () => {
      // "trabajo" vs "trabaho": sustitución j->h en posición 6, distancia 1
      expect(matchAnswer('trabaho', 'trabajo').result).toBe('close');
      // "trabajo" vs "trobaho": sustituciones en posiciones 3 y 6, distancia 2
      expect(matchAnswer('trobaho', 'trabajo').result).toBe('close');
      // "trabajo" vs "trobahz": sustituciones en posiciones 3, 6 y 7, distancia 3
      expect(matchAnswer('trobahz', 'trabajo').result).toBe('wrong');
    });

    it('respuesta larga (>8 chars, umbral 3): distancia 3 es "close", distancia 4 es "wrong"', () => {
      // "universidad" vs "univarsidoz": sustituciones en posiciones 5, 10 y 11, distancia 3
      expect(matchAnswer('univarsidoz', 'universidad').result).toBe('close');
      // "universidad" vs "xnivarsidoz": añade una 4ª sustitución en posición 1, distancia 4
      expect(matchAnswer('xnivarsidoz', 'universidad').result).toBe('wrong');
    });
  });

  describe('respuesta totalmente incorrecta', () => {
    it('devuelve "wrong" cuando no se parece en nada', () => {
      const result = matchAnswer('elefante', 'casa');
      expect(result.result).toBe('wrong');
    });

    it('devuelve "wrong" con cadena vacía', () => {
      const result = matchAnswer('', 'casa');
      expect(result.result).toBe('wrong');
    });
  });

  describe('alternativas separadas por "/"', () => {
    it('acepta cualquiera de las alternativas como válida', () => {
      const result = matchAnswer('realizar', 'hacer / realizar');
      expect(result.result).toBe('exact');
      expect(result.normalizedAnswer).toBe('realizar');
    });

    it('elige la alternativa con menor distancia', () => {
      const result = matchAnswer('hacer', 'hacer / realizar');
      expect(result.normalizedAnswer).toBe('hacer');
      expect(result.result).toBe('exact');
    });
  });

  describe('anotaciones entre paréntesis', () => {
    it('se ignoran al comparar la respuesta', () => {
      const result = matchAnswer('en realidad', 'en realidad (NO actualmente)');
      expect(result.result).toBe('exact');
      expect(result.normalizedAnswer).toBe('en realidad');
    });

    it('el input no necesita incluir la aclaración entre paréntesis', () => {
      const result = matchAnswer('cualificado', 'cualificado (NO calificado)');
      expect(result.result).toBe('exact');
    });
  });

  describe('valores de retorno', () => {
    it('incluye normalizedInput y normalizedAnswer', () => {
      const result = matchAnswer('  Hola  ', 'hola');
      expect(result.normalizedInput).toBe('hola');
      expect(result.normalizedAnswer).toBe('hola');
    });
  });
});
