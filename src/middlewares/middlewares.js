const jwt = require('jsonwebtoken');

function rejeitarSessao(req, res, statusLegado) {
    // Apenas clientes que pedem JSON explicitamente usam o contrato de API.
    // Navegações HTML mantêm o redirecionamento já utilizado pelo sistema.
    if ((req.get('accept') || '').includes('application/json')) {
        return res.status(401).json({ error: 'Sessão ausente ou expirada. Faça login novamente.' });
    }
    return res.status(statusLegado).redirect('/login');
}

function autenticarToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return rejeitarSessao(req, res, 401);
    }

    try {
        const decoded = jwt.verify(token, 'chave-secreta');
     // gera de novo um novo token com 10 minutos
        const novoToken = jwt.sign({ 
            usuemail: decoded.usuemail,
            usucod: decoded.usucod,
            usunome: decoded.usunome, 
            usuadm: decoded.usuadm,
            usupv: decoded.usupv,
            usuest: decoded.usuest,
            empusaest: decoded.empusaest,
            empusapv: decoded.empusapv
        }, 'chave-secreta', { expiresIn: '60m' });
        //console.log('Token renovado para o usuário:', 'usario est',decoded.usuest,'empresa est', decoded.empusaest);

    // gauda o novo token com mais 10m em cookies
        res.cookie('token', novoToken, {
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.HTTPS === 'true',
        });
        // Remove os outros cookies inseguros, se ainda existirem
        res.clearCookie('usucod');
        res.clearCookie('usunome');
        res.clearCookie('usuemail');
        res.clearCookie('usuadm');
        res.clearCookie('usupv');
        res.clearCookie('usuest');

        req.token = decoded; // Armazena dados decodificados para uso futuro

        next();
    } catch (err) {
        return rejeitarSessao(req, res, 500);
    }
}

module.exports = autenticarToken;
