// Serviço de Consulta FIPE via API Parallelum

const BASE_URL = "https://parallelum.com.br/fipe/api/v1";

export interface FipeMarca {
  codigo: string;
  nome: string;
}

export interface FipeModelo {
  codigo: number;
  nome: string;
}

export interface FipeAno {
  codigo: string;
  nome: string;
}

export interface FipeResult {
  TipoVeiculo: number;
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  SiglaCombustivel: string;
}

type TipoVeiculoFipe = 'carros' | 'motos' | 'caminhoes';

function normalizar(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tipoToFipe(tipo: 'carro' | 'moto' | 'caminhao'): TipoVeiculoFipe {
  switch (tipo) {
    case 'carro': return 'carros';
    case 'moto': return 'motos';
    case 'caminhao': return 'caminhoes';
    default: return 'carros';
  }
}

export async function buscarMarcas(tipo: TipoVeiculoFipe): Promise<FipeMarca[]> {
  const response = await fetch(`${BASE_URL}/${tipo}/marcas`);
  if (!response.ok) throw new Error('Erro ao buscar marcas');
  return response.json();
}

export async function buscarModelos(tipo: TipoVeiculoFipe, codigoMarca: string): Promise<{ modelos: FipeModelo[], anos: FipeAno[] }> {
  const response = await fetch(`${BASE_URL}/${tipo}/marcas/${codigoMarca}/modelos`);
  if (!response.ok) throw new Error('Erro ao buscar modelos');
  return response.json();
}

export async function buscarAnos(tipo: TipoVeiculoFipe, codigoMarca: string, codigoModelo: string): Promise<FipeAno[]> {
  const response = await fetch(`${BASE_URL}/${tipo}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`);
  if (!response.ok) throw new Error('Erro ao buscar anos');
  return response.json();
}

export async function buscarValorFipe(tipo: TipoVeiculoFipe, codigoMarca: string, codigoModelo: string, codigoAno: string): Promise<FipeResult> {
  const response = await fetch(`${BASE_URL}/${tipo}/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${codigoAno}`);
  if (!response.ok) throw new Error('Erro ao buscar valor FIPE');
  return response.json();
}

export async function buscarMarcaPorNome(tipo: TipoVeiculoFipe, nomeMarca: string): Promise<FipeMarca | undefined> {
  const marcas = await buscarMarcas(tipo);
  return marcas.find(m => normalizar(m.nome).includes(normalizar(nomeMarca)));
}

export async function buscarModeloPorNome(tipo: TipoVeiculoFipe, codigoMarca: string, nomeModelo: string): Promise<FipeModelo | undefined> {
  const { modelos } = await buscarModelos(tipo, codigoMarca);
  return modelos.find(m => normalizar(m.nome).includes(normalizar(nomeModelo)));
}

export async function buscarAnoPorValor(tipo: TipoVeiculoFipe, codigoMarca: string, codigoModelo: string, ano: number): Promise<FipeAno | undefined> {
  const anos = await buscarAnos(tipo, codigoMarca, codigoModelo.toString());
  return anos.find(a => a.nome.includes(ano.toString()));
}

export interface ConsultaFipeParams {
  tipo: 'carro' | 'moto' | 'caminhao';
  marca: string;
  modelo: string;
  ano: number;
}

export interface ConsultaFipeResult {
  success: boolean;
  data?: FipeResult;
  valorNumerico?: number;
  error?: string;
}

export async function consultarFipeAutomatico(params: ConsultaFipeParams): Promise<ConsultaFipeResult> {
  try {
    const tipoFipe = tipoToFipe(params.tipo);
    
    // Buscar marca
    const marca = await buscarMarcaPorNome(tipoFipe, params.marca);
    if (!marca) {
      return { success: false, error: `Marca "${params.marca}" não encontrada` };
    }
    
    // Buscar modelo
    const modelo = await buscarModeloPorNome(tipoFipe, marca.codigo, params.modelo);
    if (!modelo) {
      return { success: false, error: `Modelo "${params.modelo}" não encontrado para marca ${marca.nome}` };
    }
    
    // Buscar ano
    const ano = await buscarAnoPorValor(tipoFipe, marca.codigo, modelo.codigo.toString(), params.ano);
    if (!ano) {
      return { success: false, error: `Ano ${params.ano} não encontrado para ${marca.nome} ${modelo.nome}` };
    }
    
    // Buscar valor FIPE
    const resultado = await buscarValorFipe(tipoFipe, marca.codigo, modelo.codigo.toString(), ano.codigo);
    
    // Extrair valor numérico
    const valorNumerico = parseFloat(
      resultado.Valor
        .replace('R$ ', '')
        .replace(/\./g, '')
        .replace(',', '.')
    );
    
    return {
      success: true,
      data: resultado,
      valorNumerico,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export { tipoToFipe };
